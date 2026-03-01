import express from 'express'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
app.use(express.json())

app.post('/identify', async (req, res) => {
  const { email, phoneNumber } = req.body

  // Find all existing contacts matching email or phone
  const matches = await prisma.contact.findMany({
    where: {
      OR: [
        email ? { email } : {},
        phoneNumber ? { phoneNumber: String(phoneNumber) } : {}
      ],
      deletedAt: null
    }
  })

  // No matches - create new primary contact
  if (matches.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber ? String(phoneNumber) : null,
        linkPrecedence: 'primary'
      }
    })
    return res.json({
      contact: {
        primaryContatctId: newContact.id,
        emails: newContact.email ? [newContact.email] : [],
        phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
        secondaryContactIds: []
      }
    })
  }

  // Get all primary IDs from matches
  const primaryIds = matches.map(c => 
    c.linkPrecedence === 'primary' ? c.id : c.linkedId!
  )
  const uniquePrimaryIds = [...new Set(primaryIds)]

  // Fetch all contacts under these primaries
  let allContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: { in: uniquePrimaryIds } },
        { linkedId: { in: uniquePrimaryIds } }
      ],
      deletedAt: null
    }
  })

  // Find the oldest primary (the true primary)
  const primaries = allContacts.filter(c => c.linkPrecedence === 'primary')
  primaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const truePrimary = primaries[0]!

  // If multiple primaries, demote newer ones to secondary
  for (const p of primaries.slice(1)) {
    await prisma.contact.update({
      where: { id: p.id },
      data: { linkPrecedence: 'secondary', linkedId: truePrimary.id }
    })
    // Also update their secondaries to point to true primary
    await prisma.contact.updateMany({
      where: { linkedId: p.id },
      data: { linkedId: truePrimary.id }
    })
  }

  // Refetch all contacts after updates
  allContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: truePrimary.id },
        { linkedId: truePrimary.id }
      ],
      deletedAt: null
    }
  })

  // Check if incoming info is new (not already in any contact)
  const allEmails = allContacts.map(c => c.email).filter(Boolean)
  const allPhones = allContacts.map(c => c.phoneNumber).filter(Boolean)

  const isNewEmail = email && !allEmails.includes(email)
  const isNewPhone = phoneNumber && !allPhones.includes(String(phoneNumber))

  if (isNewEmail || isNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber ? String(phoneNumber) : null,
        linkedId: truePrimary.id,
        linkPrecedence: 'secondary'
      }
    })
    allContacts.push(newSecondary)
  }

  // Build response
  const secondaries = allContacts.filter(c => c.linkPrecedence === 'secondary')
  const emailsOrdered = [
    truePrimary.email,
    ...secondaries.map(c => c.email).filter(Boolean)
  ].filter((e, i, arr) => e && arr.indexOf(e) === i) as string[]

  const phonesOrdered = [
    truePrimary.phoneNumber,
    ...secondaries.map(c => c.phoneNumber).filter(Boolean)
  ].filter((p, i, arr) => p && arr.indexOf(p) === i) as string[]

  return res.json({
    contact: {
      primaryContatctId: truePrimary.id,
      emails: emailsOrdered,
      phoneNumbers: phonesOrdered,
      secondaryContactIds: secondaries.map(c => c.id)
    }
  })
})

app.listen(3000, () => console.log('Server running on port 3000'))