import operator
import re
from typing import Any, Dict, List, Optional

from content_core import extract_content
from content_core.common import ProcessSourceState
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from loguru import logger
from typing_extensions import Annotated, TypedDict

from open_notebook.ai.models import Model, ModelManager
from open_notebook.domain.content_settings import ContentSettings
from open_notebook.domain.notebook import Asset, Source
from open_notebook.domain.transformation import Transformation
from open_notebook.graphs.transformation import graph as transform_graph


def _is_youtube_url(url: str) -> bool:
    """Check if a URL is a YouTube video URL."""
    if not url:
        return False
    youtube_regex = (
        r"(?:https?://)?(?:www\.)?"
        r"(?:youtu\.be/|youtube\.com(?:/embed/|/v/|/watch\?v=|/watch\?.+&v=))"
        r"[\w-]{11}"
    )
    return bool(re.search(youtube_regex, url))


class SourceState(TypedDict):
    content_state: ProcessSourceState
    apply_transformations: List[Transformation]
    source_id: str
    notebook_ids: List[str]
    source: Source
    transformation: Annotated[list, operator.add]
    embed: bool


class TransformationState(TypedDict):
    source: Source
    transformation: Transformation


async def content_process(state: SourceState) -> dict:
    content_settings = ContentSettings(
        default_content_processing_engine_doc="auto",
        default_content_processing_engine_url="auto",
        default_embedding_option="ask",
        auto_delete_files="yes",
        youtube_preferred_languages=[
            "en",
            "ta",
            "pt",
            "es",
            "de",
            "nl",
            "en-GB",
            "fr",
            "hi",
            "ja",
        ],
    )
    content_state: Dict[str, Any] = state["content_state"]  # type: ignore[assignment]

    content_state["url_engine"] = (
        content_settings.default_content_processing_engine_url or "auto"
    )
    content_state["document_engine"] = (
        content_settings.default_content_processing_engine_doc or "auto"
    )
    content_state["output_format"] = "markdown"

    # Add speech-to-text model configuration from Default Models
    try:
        model_manager = ModelManager()
        defaults = await model_manager.get_defaults()
        if defaults.default_speech_to_text_model:
            stt_model = await Model.get(defaults.default_speech_to_text_model)
            if stt_model:
                content_state["audio_provider"] = stt_model.provider
                content_state["audio_model"] = stt_model.name
                logger.debug(
                    f"Using speech-to-text model: {stt_model.provider}/{stt_model.name}"
                )
    except Exception as e:
        logger.warning(f"Failed to retrieve speech-to-text model configuration: {e}")
        # Continue without custom audio model (content-core will use its default)

    processed_state = await extract_content(content_state)

    # Fallback: If YouTube video returned empty content (no captions), try STT transcription
    url = content_state.get("url", "") or ""
    has_content = bool(processed_state.content and processed_state.content.strip())

    if not has_content and _is_youtube_url(url):
        logger.warning(
            f"YouTube video returned empty content (no captions found). "
            f"Attempting STT audio transcription fallback..."
        )
        try:
            stt_content = await _youtube_stt_fallback(url, content_state)
            if stt_content:
                processed_state.content = stt_content
                logger.info(
                    f"STT fallback successful. Transcribed {len(stt_content)} chars."
                )
            else:
                logger.error("STT fallback returned empty content.")
        except Exception as e:
            logger.error(f"STT fallback failed: {e}")

    return {"content_state": processed_state}


async def _youtube_stt_fallback(url: str, content_state: dict) -> Optional[str]:
    """
    Download YouTube audio and transcribe it using the configured STT model.
    Used as a fallback when YouTube captions are unavailable.
    """
    import asyncio
    import math
    import os
    import tempfile

    from esperanto import AIFactory

    # Download audio from YouTube using pytubefix
    from pytubefix import YouTube

    logger.info(f"Downloading audio from YouTube: {url}")

    # Use a persistent temp directory (NOT with-block to avoid premature cleanup)
    temp_dir = tempfile.mkdtemp()
    try:
        audio_path = os.path.join(temp_dir, "audio.mp4")

        # Try pytubefix first with retries, fall back to yt-dlp
        download_success = False
        try:
            from pytubefix import YouTube

            yt = YouTube(url)
            audio_stream = (
                yt.streams.filter(only_audio=True).order_by("abr").desc().first()
            )
            if audio_stream:
                audio_path = audio_stream.download(
                    output_path=temp_dir,
                    filename="audio.mp4",
                    max_retries=5,
                    timeout=600,
                )
                download_success = True
                logger.info(
                    f"Downloaded audio via pytubefix: {audio_path} "
                    f"({os.path.getsize(audio_path)} bytes)"
                )
            else:
                logger.warning("No audio stream found via pytubefix.")
        except Exception as e:
            logger.warning(f"pytubefix download failed: {e}. Trying yt-dlp...")

        if not download_success:
            # Fallback to yt-dlp (more reliable for large/throttled videos)
            try:
                import subprocess
                import sys

                yt_dlp_bin = os.path.join(
                    os.path.dirname(sys.executable), "yt-dlp"
                )
                if not os.path.exists(yt_dlp_bin):
                    yt_dlp_bin = "yt-dlp"  # try PATH

                yt_dlp_path = os.path.join(temp_dir, "audio.%(ext)s")
                result = subprocess.run(
                    [
                        yt_dlp_bin,
                        "-f",
                        "bestaudio",
                        "-o",
                        yt_dlp_path,
                        "--no-playlist",
                        "--retries",
                        "10",
                        "--socket-timeout",
                        "30",
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=1800,  # 30 min max
                )
                if result.returncode == 0:
                    # Find the downloaded file
                    for f in os.listdir(temp_dir):
                        if f.startswith("audio."):
                            audio_path = os.path.join(temp_dir, f)
                            download_success = True
                            break
                    if download_success:
                        logger.info(
                            f"Downloaded audio via yt-dlp: {audio_path} "
                            f"({os.path.getsize(audio_path)} bytes)"
                        )
                    else:
                        logger.error("yt-dlp succeeded but no audio file found.")
                else:
                    logger.error(f"yt-dlp failed: {result.stderr}")
            except FileNotFoundError:
                logger.error(
                    "yt-dlp not installed. Install with: pip install yt-dlp"
                )
            except Exception as e:
                logger.error(f"yt-dlp fallback failed: {e}")

        if not download_success or not os.path.exists(audio_path):
            logger.error("Failed to download YouTube audio via all methods.")
            return None

        logger.info(
            f"Audio ready: {audio_path} ({os.path.getsize(audio_path)} bytes)"
        )

        # Get STT model from content_state or default
        audio_provider = content_state.get("audio_provider")
        audio_model = content_state.get("audio_model")

        if audio_provider and audio_model:
            stt_model = AIFactory.create_speech_to_text(
                audio_provider, audio_model, {"timeout": 3600}
            )
        else:
            logger.error("No STT model configured. Cannot transcribe audio.")
            return None

        # Split audio into segments using thread pool to avoid blocking event loop
        from content_core.processors.audio import transcribe_audio_segment
        from moviepy import AudioFileClip

        def _split_audio_sync(audio_path: str, temp_dir: str) -> list:
            """Split audio into segments synchronously in a worker thread."""
            audio_clip = AudioFileClip(audio_path)
            duration_s = audio_clip.duration
            audio_clip.close()

            segment_length_s = 10 * 60  # 10 minutes
            output_files = []

            if duration_s > segment_length_s:
                num_segments = math.ceil(duration_s / segment_length_s)
                logger.info(
                    f"Audio is {duration_s:.0f}s, splitting into {num_segments} segments"
                )
                for i in range(num_segments):
                    start = i * segment_length_s
                    end = min((i + 1) * segment_length_s, duration_s)
                    seg_path = os.path.join(temp_dir, f"segment_{i:03d}.mp3")

                    # Use moviepy directly for reliable segment extraction
                    clip = AudioFileClip(audio_path)
                    segment = clip.subclipped(start, end)
                    segment.write_audiofile(seg_path, codec="mp3", logger=None)
                    segment.close()
                    clip.close()

                    output_files.append(seg_path)
                    logger.debug(
                        f"Created segment {i + 1}/{num_segments}: {seg_path}"
                    )
            else:
                # Convert to mp3 for Google STT compatibility
                mp3_path = os.path.join(temp_dir, "audio.mp3")
                clip = AudioFileClip(audio_path)
                clip.write_audiofile(mp3_path, codec="mp3", logger=None)
                clip.close()
                output_files = [mp3_path]

            return output_files

        # Run splitting in thread pool so it doesn't interfere with async
        loop = asyncio.get_event_loop()
        output_files = await loop.run_in_executor(
            None, _split_audio_sync, audio_path, temp_dir
        )

        # Verify all segment files exist before transcription
        for f in output_files:
            if not os.path.exists(f):
                logger.error(f"Segment file missing: {f}")
                return None
        logger.info(
            f"All {len(output_files)} segments ready. Starting transcription..."
        )

        # Transcribe segments sequentially to handle errors gracefully
        # and save partial results if quota is exceeded
        transcriptions: list[str] = []
        failed_count = 0
        semaphore = asyncio.Semaphore(3)

        for i, audio_file in enumerate(output_files):
            try:
                text = await transcribe_audio_segment(
                    audio_file, stt_model, semaphore
                )
                transcriptions.append(text)
                logger.debug(
                    f"Transcribed segment {i + 1}/{len(output_files)} "
                    f"({len(text)} chars)"
                )
            except Exception as e:
                failed_count += 1
                logger.warning(
                    f"Failed to transcribe segment {i + 1}/{len(output_files)}: {e}"
                )
                # If we have at least some transcriptions, continue collecting
                # what we can. If the error is quota-related, subsequent will
                # also fail so we break.
                error_str = str(e).lower()
                if "quota" in error_str or "rate" in error_str:
                    logger.warning(
                        f"Quota/rate limit hit after {len(transcriptions)} "
                        f"segments. Saving partial results."
                    )
                    break

        if not transcriptions:
            logger.error("No segments were successfully transcribed.")
            return None

        result = " ".join(transcriptions)
        if failed_count > 0:
            logger.warning(
                f"Partial transcription: {len(transcriptions)}/{len(output_files)} "
                f"segments ({failed_count} failed). Total: {len(result)} chars"
            )
        else:
            logger.info(
                f"Transcription complete: {len(result)} chars "
                f"from {len(output_files)} segments"
            )
        return result

    except Exception as e:
        logger.error(f"YouTube STT fallback error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
    finally:
        # Clean up temp directory
        import shutil
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


async def save_source(state: SourceState) -> dict:
    content_state = state["content_state"]

    # Get existing source using the provided source_id
    source = await Source.get(state["source_id"])
    if not source:
        raise ValueError(f"Source with ID {state['source_id']} not found")

    # Update the source with processed content
    source.asset = Asset(url=content_state.url, file_path=content_state.file_path)
    source.full_text = content_state.content

    # Preserve existing title if none provided in processed content
    if content_state.title:
        source.title = content_state.title

    await source.save()

    # NOTE: Notebook associations are created by the API immediately for UI responsiveness
    # No need to create them here to avoid duplicate edges

    if state["embed"]:
        logger.debug("Embedding content for vector search")
        await source.vectorize()

    return {"source": source}


def trigger_transformations(state: SourceState, config: RunnableConfig) -> List[Send]:
    if len(state["apply_transformations"]) == 0:
        return []

    to_apply = state["apply_transformations"]
    logger.debug(f"Applying transformations {to_apply}")

    return [
        Send(
            "transform_content",
            {
                "source": state["source"],
                "transformation": t,
            },
        )
        for t in to_apply
    ]


async def transform_content(state: TransformationState) -> Optional[dict]:
    source = state["source"]
    content = source.full_text
    if not content:
        return None
    transformation: Transformation = state["transformation"]

    logger.debug(f"Applying transformation {transformation.name}")
    result = await transform_graph.ainvoke(
        dict(input_text=content, transformation=transformation)  # type: ignore[arg-type]
    )
    await source.add_insight(transformation.title, result["output"])
    return {
        "transformation": [
            {
                "output": result["output"],
                "transformation_name": transformation.name,
            }
        ]
    }


# Create and compile the workflow
workflow = StateGraph(SourceState)

# Add nodes
workflow.add_node("content_process", content_process)
workflow.add_node("save_source", save_source)
workflow.add_node("transform_content", transform_content)
# Define the graph edges
workflow.add_edge(START, "content_process")
workflow.add_edge("content_process", "save_source")
workflow.add_conditional_edges(
    "save_source", trigger_transformations, ["transform_content"]
)
workflow.add_edge("transform_content", END)

# Compile the graph
source_graph = workflow.compile()
