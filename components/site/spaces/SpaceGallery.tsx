import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { Bed } from 'lucide-react'

interface SpaceGalleryProps {
  images: string[]
  label: string
  primaryColor: string
}

export function SpaceGallery({ images, label, primaryColor }: SpaceGalleryProps) {
  if (images.length > 0) {
    return (
      <div className="mb-6">
        <ProductImageGallery images={images} productName={label} primaryColor={primaryColor} />
      </div>
    )
  }

  return (
    <div
      className="h-72 rounded-2xl flex items-center justify-center mb-6"
      style={{ background: `linear-gradient(135deg, ${primaryColor}30 0%, ${primaryColor}10 100%)` }}
    >
      <Bed className="h-24 w-24" style={{ color: primaryColor }} />
    </div>
  )
}
