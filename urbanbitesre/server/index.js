import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { siteContent } from '../src/siteContent.js'

const app = express()
const port = process.env.PORT || 3001
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')
const reservations = []
const orders = []

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/content', (_request, response) => {
  response.json(siteContent)
})

app.get('/api/reservations', (_request, response) => {
  response.json({ count: reservations.length, reservations })
})

app.get('/api/orders', (_request, response) => {
  response.json({ count: orders.length, orders })
})

app.post('/api/reservations', (request, response) => {
  const { name, email, guests, date, period = 'PM', notes = '' } = request.body

  const normalizedPeriod = String(period).toUpperCase()

  if (!['AM', 'PM'].includes(normalizedPeriod)) {
    response.status(400).json({ message: 'Reservation period must be AM or PM.' })
    return
  }

  if (!name || !email || !date) {
    response.status(400).json({ message: 'Name, email, and reservation date are required.' })
    return
  }

  const reservationDate = new Date(date)

  if (Number.isNaN(reservationDate.getTime())) {
    response.status(400).json({ message: 'Please provide a valid reservation date and time.' })
    return
  }

  const normalizedGuests = Number.parseInt(guests, 10)

  if (!Number.isInteger(normalizedGuests) || normalizedGuests < 1 || normalizedGuests > 12) {
    response.status(400).json({ message: 'Guest count must be between 1 and 12.' })
    return
  }

  const reservation = {
    id: reservations.length + 1,
    name: String(name).trim(),
    email: String(email).trim(),
    guests: normalizedGuests,
    date: reservationDate.toISOString(),
    period: normalizedPeriod,
    notes: String(notes).trim(),
    createdAt: new Date().toISOString(),
  }

  reservations.push(reservation)

  response.status(201).json({
    message: `Reservation request received for ${reservation.name} (${reservation.period}). We will contact you shortly at ${reservation.email}.`,
    reservation,
  })
})

app.post('/api/orders', (request, response) => {
  const {
    customerName,
    phone,
    preferredPeriod = 'PM',
    deliveryAddress = '',
    items = [],
    notes = '',
  } = request.body

  const normalizedPeriod = String(preferredPeriod).toUpperCase()

  if (!['AM', 'PM'].includes(normalizedPeriod)) {
    response.status(400).json({ message: 'Order period must be AM or PM.' })
    return
  }

  if (!customerName || !phone) {
    response.status(400).json({ message: 'Customer name and phone are required for orders.' })
    return
  }

  if (!Array.isArray(items) || items.length === 0) {
    response.status(400).json({ message: 'Add at least one menu item to place an order.' })
    return
  }

  const normalizedItems = items
    .map((item) => ({
      title: String(item.title || '').trim(),
      quantity: Number.parseInt(item.quantity, 10),
      price: Number(item.price),
    }))
    .filter((item) => item.title && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0)

  if (normalizedItems.length !== items.length) {
    response.status(400).json({ message: 'Some order items are invalid. Please review your cart and try again.' })
    return
  }

  const total = normalizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const order = {
    id: orders.length + 1,
    customerName: String(customerName).trim(),
    phone: String(phone).trim(),
    preferredPeriod: normalizedPeriod,
    deliveryAddress: String(deliveryAddress).trim(),
    notes: String(notes).trim(),
    items: normalizedItems,
    total,
    createdAt: new Date().toISOString(),
  }

  orders.push(order)

  response.status(201).json({
    message: `Order placed for ${order.customerName} (${order.preferredPeriod}). Total: INR ${Math.round(order.total).toLocaleString('en-IN')}.`,
    order,
  })
})

app.use('/api', (_request, response) => {
  response.status(404).json({ message: 'API endpoint not found.' })
})

app.use((error, _request, response, _next) => {
  console.error(error)

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    response.status(400).json({ message: 'Invalid JSON payload.' })
    return
  }

  response.status(500).json({ message: 'Unexpected server error.' })
})

app.use(express.static(distPath))

app.get(/^(?!\/api\/).*/, (_request, response) => {
  response.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`Urban Bites server running on http://localhost:${port}`)
})