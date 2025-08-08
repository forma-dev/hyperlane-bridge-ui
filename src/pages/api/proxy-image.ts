import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '../../utils/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' })
  }

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image not found' })
    }

    const contentType = response.headers.get('content-type')
    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType || 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    res.send(Buffer.from(buffer))
  } catch (error) {
    logger.error('Error proxying image', error)
    res.status(500).json({ error: 'Failed to proxy image' })
  }
} 