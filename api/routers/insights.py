from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from api.auth import get_user_id
from api.models import NoteResponse, SaveAsNoteRequest, SourceInsightResponse
from open_notebook.domain.notebook import SourceInsight
from open_notebook.exceptions import InvalidInputError

router = APIRouter()


@router.get("/insights/{insight_id}", response_model=SourceInsightResponse)
async def get_insight(
    insight_id: str,
    user_id: Optional[str] = Depends(get_user_id),
):
    """Get a specific insight by ID."""
    try:
        insight = await SourceInsight.get(insight_id)
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")
        if user_id and insight.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this insight")

        # Get source ID from the insight relationship
        source = await insight.get_source()

        return SourceInsightResponse(
            id=insight.id or "",
            source_id=source.id or "",
            insight_type=insight.insight_type,
            content=insight.content,
            created=str(insight.created),
            updated=str(insight.updated),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching insight {insight_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching insight")


@router.delete("/insights/{insight_id}")
async def delete_insight(
    insight_id: str,
    user_id: Optional[str] = Depends(get_user_id),
):
    """Delete a specific insight."""
    try:
        insight = await SourceInsight.get(insight_id)
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")
        if user_id and insight.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this insight")

        await insight.delete()

        return {"message": "Insight deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting insight {insight_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting insight")


@router.post("/insights/{insight_id}/save-as-note", response_model=NoteResponse)
async def save_insight_as_note(
    insight_id: str,
    request: SaveAsNoteRequest,
    user_id: Optional[str] = Depends(get_user_id),
):
    """Convert an insight to a note."""
    try:
        insight = await SourceInsight.get(insight_id)
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")
        if user_id and insight.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this insight")

        # Use the existing save_as_note method from the domain model
        note = await insight.save_as_note(request.notebook_id)

        return NoteResponse(
            id=note.id or "",
            title=note.title,
            content=note.content,
            note_type=note.note_type,
            created=str(note.created),
            updated=str(note.updated),
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error saving insight {insight_id} as note: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error saving insight as note"
        )
