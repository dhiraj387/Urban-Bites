import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { siteContent as fallbackContent } from './siteContent'

gsap.registerPlugin(ScrollTrigger)

const initialFormState = {
  name: '',
  email: '',
  guests: '2',
  date: '',
  period: 'PM',
  notes: '',
}

async function parseJsonSafely(response) {
  const rawText = await response.text()

  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

const isRetryableStatus = (status) => status === 502 || status === 503

const parseRupeeValue = (priceLabel) => Number.parseInt(String(priceLabel).replace(/[^\d]/g, ''), 10) || 0

const formatRupeeValue = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`

function buildApiErrorMessage(response, payload, fallbackMessage) {
  if (payload?.message) {
    return payload.message
  }

  if (response.status === 502 || response.status === 503) {
    return `${fallbackMessage} Backend server is unavailable (HTTP ${response.status}). Start backend with npm run dev.`
  }

  if (response.status === 404 || response.status === 405) {
    return `${fallbackMessage} API route not found (HTTP ${response.status}). Start backend with npm run dev.`
  }

  if (response.status >= 500) {
    return `${fallbackMessage} Server error (HTTP ${response.status}). Please try again.`
  }

  return `${fallbackMessage} (HTTP ${response.status}).`
}

const socialIconMap = {
  instagram: {
    className: 'hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  facebook: {
    className: 'hover:bg-[#1877f2]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  linkedin: {
    className: 'hover:bg-[#0a66c2]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  snapchat: {
    className: 'hover:bg-[#fffc00] hover:text-ink',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M12 2C8.5 2 6 4.5 6 8v1.5c-.5.1-1 .4-1.3.9-.3.4-.2.9.1 1.2.4.4.4.8.2 1.3C4.4 14 3 14.5 3 15.5c0 .4.3.8.8.9 1 .2 1.8.7 2.4 1.4.2.3.2.6 0 .9C6 19 5.8 19.2 6 19.5c.2.3.6.5 1 .5.3 0 .6-.1.9-.3.5-.3 1.1-.5 1.8-.3.5.1.9.4 1.3.7.3.2.7.4 1 .4s.7-.2 1-.4c.4-.3.8-.6 1.3-.7.7-.2 1.3 0 1.8.3.3.2.6.3.9.3.4 0 .8-.2 1-.5.2-.3 0-.5-.2-.7-.2-.3-.2-.6 0-.9.6-.7 1.4-1.2 2.4-1.4.5-.1.8-.5.8-.9 0-1-1.4-1.5-2-2.2-.2-.5-.2-.9.2-1.3.3-.3.4-.8.1-1.2-.3-.5-.8-.8-1.3-.9V8c0-3.5-2.5-6-6-6z" />
      </svg>
    ),
  },
}

const initialOrderFormState = {
  customerName: '',
  phone: '',
  preferredPeriod: 'PM',
  deliveryAddress: '',
  notes: '',
}

function App() {
  const appRef = useRef(null)
  const menuSearchInputRef = useRef(null)
  const lastSliderMouseXRef = useRef(null)
  const lastSliderTouchXRef = useRef(null)
  const [content, setContent] = useState(fallbackContent)
  const [contentError, setContentError] = useState('')
  const [formData, setFormData] = useState(initialFormState)
  const [submitState, setSubmitState] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [orderFormData, setOrderFormData] = useState(initialOrderFormState)
  const [orderState, setOrderState] = useState({ type: '', message: '' })
  const [isOrdering, setIsOrdering] = useState(false)
  const [menuSearch, setMenuSearch] = useState('')
  const [menuSort, setMenuSort] = useState('recommended')
  const [showAllMenuItems, setShowAllMenuItems] = useState(false)
  const [sliderShiftPercent, setSliderShiftPercent] = useState(-50)

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.priceValue * item.quantity), 0)
  const sliderBaseItems = content.menuItems.slice(0, 25)
  const leftSliderItems = [...sliderBaseItems, ...sliderBaseItems]
  const filteredMenuItems = content.menuItems.filter((item) => {
    const query = menuSearch.trim().toLowerCase()

    if (!query) {
      return true
    }

    const haystack = `${item.title} ${item.specialization || ''} ${item.description || ''}`.toLowerCase()
    return haystack.includes(query)
  })
  const displayedMenuItems = [...filteredMenuItems].sort((firstItem, secondItem) => {
    if (menuSort === 'name-asc') {
      return firstItem.title.localeCompare(secondItem.title)
    }

    if (menuSort === 'price-asc') {
      return parseRupeeValue(firstItem.price) - parseRupeeValue(secondItem.price)
    }

    if (menuSort === 'price-desc') {
      return parseRupeeValue(secondItem.price) - parseRupeeValue(firstItem.price)
    }

    return 0
  })
  const visibleMenuItems = showAllMenuItems ? displayedMenuItems : displayedMenuItems.slice(0, 6)

  useEffect(() => {
    const abortController = new AbortController()

    async function loadContent() {
      try {
        let response = null
        let payload = null

        for (let attempt = 0; attempt < 2; attempt += 1) {
          response = await fetch('/api/content', { signal: abortController.signal })
          payload = await parseJsonSafely(response)

          if (!isRetryableStatus(response.status) || attempt === 1) {
            break
          }

          await wait(700)
        }

        if (!response.ok) {
          throw new Error(payload?.message || 'Unable to load restaurant content right now.')
        }

        if (!payload) {
          throw new Error('Backend returned an invalid content response.')
        }

        setContent(payload)
        setContentError('')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setContentError(error.message)
        }
      }
    }

    loadContent()

    return () => abortController.abort()
  }, [])

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (prefersReducedMotion) {
        return
      }

      ScrollTrigger.getAll().forEach((trigger) => trigger.kill())

      gsap.from('.animate-nav', {
        y: -36,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'all',
      })

      gsap.from('.animate-hero', {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.14,
        delay: 0.15,
        clearProps: 'all',
      })

      gsap.from('.animate-stat', {
        y: 28,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        stagger: 0.1,
        delay: 0.45,
        clearProps: 'all',
      })

      gsap.utils.toArray('.animate-section').forEach((section) => {
        gsap.from(section, {
          y: 56,
          opacity: 0,
          duration: 0.95,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: section,
            start: 'top 78%',
            once: true,
          },
        })
      })

      gsap.utils.toArray('.animate-card').forEach((card, index) => {
        gsap.from(card, {
          y: 42,
          opacity: 0,
          duration: 0.8,
          delay: index * 0.08,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: card,
            start: 'top 84%',
            once: true,
          },
        })
      })
    }, appRef)

    return () => context.revert()
  }, [content])

  const handleInputChange = (event) => {
    const { name, value } = event.target

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }))
  }

  const handleOrderInputChange = (event) => {
    const { name, value } = event.target

    setOrderFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }))
  }

  const addMenuItemToCart = (menuItem) => {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.title === menuItem.title)

      if (existingItem) {
        return currentItems.map((item) => (
          item.title === menuItem.title ? { ...item, quantity: item.quantity + 1 } : item
        ))
      }

      return [
        ...currentItems,
        {
          title: menuItem.title,
          priceLabel: menuItem.price,
          priceValue: parseRupeeValue(menuItem.price),
          quantity: 1,
        },
      ]
    })

    setOrderState({ type: '', message: '' })
  }

  const increaseCartItem = (title) => {
    setCartItems((currentItems) => currentItems.map((item) => (
      item.title === title ? { ...item, quantity: item.quantity + 1 } : item
    )))
  }

  const decreaseCartItem = (title) => {
    setCartItems((currentItems) => currentItems
      .map((item) => (item.title === title ? { ...item, quantity: item.quantity - 1 } : item))
      .filter((item) => item.quantity > 0))
  }

  const removeCartItem = (title) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.title !== title))
  }

  const handleSliderItemSelect = (title) => {
    setMenuSearch(title)
    setShowAllMenuItems(false)

    if (menuSearchInputRef.current) {
      menuSearchInputRef.current.focus()
      menuSearchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSliderMouseMove = (event) => {
    const currentX = event.clientX
    const containerWidth = event.currentTarget.clientWidth || 1

    if (lastSliderMouseXRef.current === null) {
      lastSliderMouseXRef.current = currentX
      return
    }

    const deltaX = currentX - lastSliderMouseXRef.current
    lastSliderMouseXRef.current = currentX

    setSliderShiftPercent((currentShift) => {
      const deltaPercent = (deltaX / containerWidth) * 14
      let nextShift = currentShift + deltaPercent

      while (nextShift >= 0) {
        nextShift -= 50
      }

      while (nextShift < -50) {
        nextShift += 50
      }

      return nextShift
    })
  }

  const handleSliderMouseLeave = () => {
    lastSliderMouseXRef.current = null
  }

  const handleSliderTouchStart = (event) => {
    if (event.touches.length > 0) {
      lastSliderTouchXRef.current = event.touches[0].clientX
    }
  }

  const handleSliderTouchMove = (event) => {
    if (event.touches.length === 0 || lastSliderTouchXRef.current === null) {
      return
    }

    const currentX = event.touches[0].clientX
    const containerWidth = event.currentTarget.clientWidth || 1
    const deltaX = currentX - lastSliderTouchXRef.current
    lastSliderTouchXRef.current = currentX

    setSliderShiftPercent((currentShift) => {
      const deltaPercent = (deltaX / containerWidth) * 14
      let nextShift = currentShift + deltaPercent

      while (nextShift >= 0) {
        nextShift -= 50
      }

      while (nextShift < -50) {
        nextShift += 50
      }

      return nextShift
    })
  }

  const handleSliderTouchEnd = () => {
    lastSliderTouchXRef.current = null
  }

  const handleReservationSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitState({ type: '', message: '' })

    try {
      let response = null
      let payload = null

      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch('/api/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            period: formData.period,
          }),
        })

        payload = await parseJsonSafely(response)

        if (!isRetryableStatus(response.status) || attempt === 1) {
          break
        }

        await wait(700)
      }

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, payload, 'Reservation request failed.'))
      }

      if (!payload || !payload.message) {
        throw new Error('Reservation submitted, but the server response was invalid.')
      }

      setSubmitState({ type: 'success', message: payload.message })
      setFormData(initialFormState)
    } catch (error) {
      if (error.name === 'TypeError') {
        setSubmitState({
          type: 'error',
          message: 'Unable to reach reservation server. Start backend with npm run dev and try again.',
        })
      } else {
        setSubmitState({ type: 'error', message: error.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOrderSubmit = async (event) => {
    event.preventDefault()

    if (cartItems.length === 0) {
      setOrderState({ type: 'error', message: 'Your cart is empty. Add menu items before placing an order.' })
      return
    }

    setIsOrdering(true)
    setOrderState({ type: '', message: '' })

    try {
      let response = null
      let payload = null

      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...orderFormData,
            items: cartItems.map((item) => ({
              title: item.title,
              quantity: item.quantity,
              price: item.priceValue,
            })),
          }),
        })

        payload = await parseJsonSafely(response)

        if (!isRetryableStatus(response.status) || attempt === 1) {
          break
        }

        await wait(700)
      }

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, payload, 'Order placement failed.'))
      }

      if (!payload || !payload.message) {
        throw new Error('Order submitted, but the server response was invalid.')
      }

      setOrderState({ type: 'success', message: payload.message })
      setCartItems([])
      setOrderFormData(initialOrderFormState)
    } catch (error) {
      if (error.name === 'TypeError') {
        setOrderState({
          type: 'error',
          message: 'Unable to reach order server. Start backend with npm run dev and try again.',
        })
      } else {
        setOrderState({ type: 'error', message: error.message })
      }
    } finally {
      setIsOrdering(false)
    }
  }

  const year = new Date().getFullYear()

  return (
    <div ref={appRef} className="min-h-screen bg-ink text-sand">
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(circle_at_top,#3f1f15_0%,#110f10_42%,#090708_100%)]">
        <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute bottom-0 right-[-6rem] h-80 w-80 rounded-full bg-saffron/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#120f10]/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-[min(1120px,calc(100%-1.25rem))] flex-wrap items-center justify-center gap-4 py-3 sm:w-[min(1120px,calc(100%-1.5rem))] sm:justify-between sm:py-4">
          <a href="#home" className="animate-nav flex items-center gap-3 sm:gap-4">
            <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-ember/50 bg-white shadow-glow sm:h-16 sm:w-16">
              <img src={content.brand.logo} alt="D24 logo" className="h-full w-full object-cover" />
              <span className="absolute inset-[-5px] rounded-full border border-ember/60" />
            </span>
            <span className="flex flex-col">
              <span className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.24em] text-saffron sm:text-[0.72rem] sm:tracking-[0.34em]">
                {content.brand.eyebrow}
              </span>
              <span className="font-display text-[2rem] font-semibold leading-none text-sand sm:text-4xl">
                {content.brand.title}
              </span>
            </span>
          </a>

          <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/5 p-2 text-sm font-semibold text-sand/90 sm:w-auto sm:rounded-full sm:border-0 sm:bg-transparent sm:p-0 sm:text-base">
            {['Home', 'Menu', 'Gallery', 'Contact'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="animate-nav rounded-full px-3 py-2 transition duration-300 hover:-translate-y-0.5 hover:bg-ember hover:text-white sm:px-4"
              >
                {item}
              </a>
            ))}
            <a
              href="#cart"
              aria-label="Open Cart"
              title="Open Cart"
              className="animate-nav relative grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/5 text-white transition duration-300 hover:-translate-y-0.5 hover:border-saffron"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M3 4h2l2.1 10.2a1.8 1.8 0 0 0 1.8 1.4h8.9a1.8 1.8 0 0 0 1.8-1.4L22 8H7" />
              </svg>
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-ember px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            </a>
            <a
              href="#contact"
              aria-label="Reserve Table"
              title="Reserve Table"
              className="animate-nav grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-saffron to-ember text-white shadow-[0_16px_30px_rgba(207,92,54,0.3)] transition duration-300 hover:-translate-y-0.5"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4 6h16" />
                <path d="M7 3v6" />
                <path d="M17 3v6" />
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M8 11h8" />
              </svg>
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section id="home" className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-hero-overlay" />
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{
              backgroundImage: `url('${content.hero.background}')`,
            }}
          />

          <div className="mx-auto grid min-h-[72vh] w-[min(1120px,calc(100%-1.25rem))] items-center gap-10 py-12 sm:w-[min(1120px,calc(100%-1.5rem))] sm:py-16 lg:min-h-[82vh] lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-24">
            <div className="max-w-2xl">
              <p className="animate-hero font-sans text-xs font-bold uppercase tracking-[0.36em] text-saffron sm:text-sm">
                {content.hero.tag}
              </p>
              <h1 className="animate-hero mt-4 max-w-[11ch] font-display text-[3rem] leading-[0.9] text-sand sm:text-6xl lg:text-[6.4rem]">
                {content.hero.title}
              </h1>
              <p className="animate-hero mt-5 max-w-xl text-[0.98rem] text-sand/78 sm:mt-6 sm:text-lg">
                {content.hero.description}
              </p>
              <div className="animate-hero mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                <a
                  href={content.hero.primaryAction.href}
                  className="rounded-full bg-gradient-to-r from-saffron to-ember px-6 py-3 text-center font-semibold text-white shadow-glow transition duration-300 hover:-translate-y-1 sm:w-auto"
                >
                  {content.hero.primaryAction.label}
                </a>
                <a
                  href={content.hero.secondaryAction.href}
                  className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-sand transition duration-300 hover:border-saffron hover:bg-white/5 sm:w-auto"
                >
                  {content.hero.secondaryAction.label}
                </a>
              </div>
              {contentError ? (
                <p className="animate-hero mt-4 text-sm text-[#f8b4a5]">
                  {contentError} Showing fallback content.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-glow backdrop-blur sm:grid-cols-3 sm:p-5 lg:grid-cols-1">
              {content.stats.map((stat) => (
                <div key={stat.label} className="animate-stat rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
                  <p className="font-display text-3xl text-sand sm:text-4xl">{stat.value}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-mist sm:text-sm sm:tracking-[0.25em]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="menu" className="animate-section mx-auto w-[min(1120px,calc(100%-1.25rem))] py-16 sm:w-[min(1120px,calc(100%-1.5rem))] sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.34em] text-saffron sm:text-sm">{content.menuHeading.tag}</p>
            <h2 className="mt-3 font-display text-[2.4rem] text-sand sm:text-5xl">{content.menuHeading.title}</h2>
            <p className="mt-4 text-sand/68">{content.menuHeading.description}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="menu-search" className="mb-2 block text-sm font-semibold text-sand">
                  Search by name or specialization
                </label>
                <input
                  ref={menuSearchInputRef}
                  id="menu-search"
                  type="text"
                  value={menuSearch}
                  onChange={(event) => {
                    setMenuSearch(event.target.value)
                    setShowAllMenuItems(false)
                  }}
                  placeholder="Example: biryani, grilled, truffle"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                />
              </div>
              <div>
                <label htmlFor="menu-sort" className="mb-2 block text-sm font-semibold text-sand">
                  Order items
                </label>
                <select
                  id="menu-sort"
                  value={menuSort}
                  onChange={(event) => {
                    setMenuSort(event.target.value)
                    setShowAllMenuItems(false)
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                >
                  <option value="recommended">Recommended</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-4">
              <div
                className="menu-slider-wrap"
                onMouseMove={handleSliderMouseMove}
                onMouseLeave={handleSliderMouseLeave}
                onTouchStart={handleSliderTouchStart}
                onTouchMove={handleSliderTouchMove}
                onTouchEnd={handleSliderTouchEnd}
              >
                <div className="menu-slider-track" style={{ transform: `translateX(${sliderShiftPercent}%)` }}>
                  {leftSliderItems.map((item, index) => (
                    <button
                      key={`left-${item.title}-${index}`}
                      type="button"
                      onClick={() => handleSliderItemSelect(item.title)}
                      className="menu-slider-pill"
                    >
                      {item.title} - {item.specialization || 'Chef special'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {visibleMenuItems.map((item) => (
              <article
                key={item.title}
                className="animate-card group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-clay/90 shadow-glow transition duration-300 hover:-translate-y-2"
              >
                <div className="h-48 overflow-hidden sm:h-52 lg:h-60">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110 group-hover:saturate-125"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-4">
                    <h3 className="break-words font-sans text-base font-semibold text-sand sm:text-lg">{item.title}</h3>
                    <span className="shrink-0 font-sans text-base font-extrabold text-saffron">{item.price}</span>
                  </div>
                  <p className="mt-2 break-words text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-saffron/90 sm:text-xs sm:tracking-[0.18em]">
                    {item.specialization || 'Chef special'}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-mist">{item.description}</p>
                  <button
                    type="button"
                    onClick={() => addMenuItemToCart(item)}
                    className="mt-4 w-full rounded-full border border-saffron/70 px-4 py-2 text-sm font-semibold text-saffron transition duration-300 hover:bg-saffron hover:text-black sm:mt-auto sm:w-auto"
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
          {displayedMenuItems.length > 6 ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllMenuItems((currentValue) => !currentValue)}
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-sand transition duration-300 hover:border-saffron hover:text-saffron"
              >
                {showAllMenuItems ? 'Show Less' : `View More (${displayedMenuItems.length - 6} more)`}
              </button>
            </div>
          ) : null}
          {displayedMenuItems.length === 0 ? (
            <p className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-mist">
              No menu items match your search. Try another dish name or specialization.
            </p>
          ) : null}
        </section>

        <section id="cart" className="animate-section mx-auto w-[min(1120px,calc(100%-1.25rem))] py-16 sm:w-[min(1120px,calc(100%-1.5rem))] sm:py-20 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:gap-10">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur sm:p-8">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.34em] text-saffron sm:text-sm">Your Cart</p>
              <h2 className="mt-3 font-display text-[2.4rem] text-sand sm:text-5xl">Add, review, order</h2>
              <p className="mt-4 text-sand/68">Pick dishes from the menu, adjust quantities, and place your order in one step.</p>

              {cartItems.length === 0 ? (
                <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/20 bg-black/20 p-5 text-mist">
                  Your cart is empty. Tap <span className="font-semibold text-sand">Add to Cart</span> on any menu item.
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.title} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-sand">{item.title}</p>
                          <p className="text-sm text-mist">{item.priceLabel} each</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                          <button
                            type="button"
                            onClick={() => decreaseCartItem(item.title)}
                            className="h-9 w-9 rounded-full border border-white/20 text-lg text-sand transition hover:border-saffron"
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold text-sand">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => increaseCartItem(item.title)}
                            className="h-9 w-9 rounded-full border border-white/20 text-lg text-sand transition hover:border-saffron"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.title)}
                            className="ml-1 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-mist transition hover:border-[#f8b4a5] hover:text-[#f8b4a5]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-saffron">
                        Item total: {formatRupeeValue(item.priceValue * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.18em] text-mist">Subtotal</p>
                  <p className="text-xl font-bold text-saffron">{formatRupeeValue(cartSubtotal)}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="animate-card rounded-[2rem] border border-white/10 bg-clay/85 p-6 shadow-glow sm:p-8">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.34em] text-saffron sm:text-sm">Order details</p>
              <h3 className="mt-3 font-display text-4xl text-sand">Place order</h3>

              <div className="mt-6 grid gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Customer Name</span>
                  <input
                    type="text"
                    name="customerName"
                    value={orderFormData.customerName}
                    onChange={handleOrderInputChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="Who should receive the order?"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    value={orderFormData.phone}
                    onChange={handleOrderInputChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="Contact number"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">AM / PM</span>
                  <select
                    name="preferredPeriod"
                    value={orderFormData.preferredPeriod}
                    onChange={handleOrderInputChange}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Delivery Address</span>
                  <textarea
                    name="deliveryAddress"
                    value={orderFormData.deliveryAddress}
                    onChange={handleOrderInputChange}
                    rows="3"
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="Flat, street, landmark"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Order Notes</span>
                  <textarea
                    name="notes"
                    value={orderFormData.notes}
                    onChange={handleOrderInputChange}
                    rows="3"
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="Extra spice, no onions, or packing notes"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={isOrdering || cartItems.length === 0}
                  className="rounded-full bg-gradient-to-r from-saffron to-ember px-6 py-3 font-semibold text-white shadow-glow transition duration-300 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isOrdering ? 'Placing order...' : 'Place Order'}
                </button>
                {orderState.message ? (
                  <p className={`text-sm ${orderState.type === 'success' ? 'text-[#b9fbc0]' : 'text-[#f8b4a5]'}`}>
                    {orderState.message}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </section>

        <section id="gallery" className="animate-section bg-section-fade">
          <div className="mx-auto w-[min(1120px,calc(100%-1.25rem))] py-16 sm:w-[min(1120px,calc(100%-1.5rem))] sm:py-20 lg:py-24">
            <div className="max-w-2xl">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.34em] text-saffron sm:text-sm">
                {content.galleryHeading.tag}
              </p>
              <h2 className="mt-3 font-display text-[2.4rem] text-sand sm:text-5xl">{content.galleryHeading.title}</h2>
              <p className="mt-4 text-sand/68">{content.galleryHeading.description}</p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.9fr_1.1fr]">
              {content.galleryItems.map((item) => (
                <div key={item.alt} className="animate-card group overflow-hidden rounded-[1.75rem] border border-white/10 shadow-glow">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-60 w-full object-cover transition duration-500 group-hover:scale-105 group-hover:saturate-125 sm:h-72 lg:h-80"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="animate-section mx-auto w-[min(1120px,calc(100%-1.25rem))] py-16 sm:w-[min(1120px,calc(100%-1.5rem))] sm:py-20 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur sm:p-8">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.34em] text-saffron sm:text-sm">Reservations</p>
              <h2 className="mt-3 font-display text-[2.4rem] text-sand sm:text-5xl">{content.contact.title}</h2>
              <p className="mt-4 max-w-xl text-sand/68">{content.contact.description}</p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="animate-card rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-saffron">Address</p>
                  <p className="mt-3 text-mist">{content.contact.address}</p>
                </div>
                <div className="animate-card rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-saffron">Open Hours</p>
                  <p className="mt-3 text-mist">{content.contact.hours}</p>
                </div>
                <div className="animate-card rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-saffron">Phone</p>
                  <p className="mt-3 text-mist">{content.contact.phone}</p>
                </div>
                <div className="animate-card rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-saffron">Email</p>
                  <p className="mt-3 text-mist">{content.contact.email}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleReservationSubmit} className="animate-card rounded-[2rem] border border-white/10 bg-clay/85 p-6 shadow-glow sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Name</span>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="Your full name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                    placeholder="name@example.com"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Guests</span>
                  <select
                    name="guests"
                    value={formData.guests}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">Date</span>
                  <input
                    type="datetime-local"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-sand">AM / PM</span>
                  <select
                    name="period"
                    value={formData.period}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </label>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-sand">Notes</span>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="5"
                  className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-sand outline-none transition focus:border-saffron"
                  placeholder="Dietary preferences, occasion, or seating requests"
                />
              </label>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-gradient-to-r from-saffron to-ember px-6 py-3 font-semibold text-white shadow-glow transition duration-300 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Sending request...' : 'Request Reservation'}
                </button>
                {submitState.message ? (
                  <p className={`text-sm ${submitState.type === 'success' ? 'text-[#b9fbc0]' : 'text-[#f8b4a5]'}`}>
                    {submitState.message}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="animate-section border-t border-white/10 py-8">
        <div className="mx-auto flex w-[min(1120px,calc(100%-1.25rem))] flex-col gap-5 text-center text-mist sm:w-[min(1120px,calc(100%-1.5rem))] lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <div>
            <p className="font-display text-3xl text-sand">{content.brand.title}</p>
            <p className="mt-2 text-sm text-mist">Modern comfort food and late-night tables in the heart of the city.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            {content.socialLinks.map((link) => {
              const iconConfig = socialIconMap[link.platform] || socialIconMap.instagram

              return (
                <a
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  className={`grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-mist transition duration-300 hover:-translate-y-1 hover:text-white ${iconConfig.className}`}
                >
                  {iconConfig.icon}
                </a>
              )
            })}
          </div>

          <p className="text-sm text-mist">© {year} {content.brand.title}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App