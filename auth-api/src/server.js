// const { app } = require('./app')
// const { env } = require('./config/env')
// const { verifyTransporter } = require('./services/mailService')

// app.listen(env.PORT, () => {
//   console.log(`Auth API listening on :${env.PORT}`)
//   verifyTransporter().catch((error) => {
//     console.warn('SMTP failed:', error?.message || error)
//   })
// })
const { app } = require('./app')
const { verifyTransporter } = require('./services/mailService')

const PORT = 4000

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Auth API listening on :${PORT}`)

  verifyTransporter().catch((error) => {
    console.warn('SMTP failed:', error?.message || error)
  })
})
