export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Seed basado en tiempo - cambia cada minuto, garantizando que ambos componentes
// (ReviewSummaryBadge y ProductReviews) en la misma página obtengan el mismo seed
export function getSessionSeed(productId: number): number {
  return Math.floor(Date.now() / 60000) + productId * 31
}

export function getReviewStats(productId: number, sessionSeed: number) {
  const baseCount = 800 + Math.floor(seededRandom(productId + sessionSeed) * 800)
  const variation = 0.8 + seededRandom(sessionSeed * 3 + productId) * 0.3
  const finalCount = Math.floor(baseCount * variation)
  const targetAvg = 4.4 + seededRandom(sessionSeed * 5 + productId * 7) * 0.5

  const t = Math.max(0, Math.min(1, (targetAvg - 4.4) / 0.5))
  const pct5 = 0.60 + t * 0.32
  const pct4 = 0.30 - t * 0.24
  const pct3 = 0.07 - t * 0.055
  const pct2 = 0.02 - t * 0.017

  let totalRating = 0
  for (let i = 0; i < finalCount; i++) {
    const seed1 = productId * 10000 + i + sessionSeed * 7
    const rand = seededRandom(seed1)
    let rating: number
    if (rand < pct5) rating = 5
    else if (rand < pct5 + pct4) rating = 4
    else if (rand < pct5 + pct4 + pct3) rating = 3
    else if (rand < pct5 + pct4 + pct3 + pct2) rating = 2
    else rating = 1
    totalRating += rating
  }

  const avg = finalCount > 0 ? totalRating / finalCount : 0
  return { avgRating: avg, totalReviews: finalCount, targetAvg }
}
