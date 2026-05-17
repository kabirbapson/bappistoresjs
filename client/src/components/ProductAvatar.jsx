import { useState } from 'react'
import { getCategoryIcon } from '../utils/productImage'

export default function ProductAvatar({ product, className = 'h-16 w-16 rounded-lg' }) {
  const [failed, setFailed] = useState(false)
  const showImage = product?.imageUrl && !failed

  if (showImage) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        className={`${className} object-cover`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-slate-100 text-3xl`}
      aria-hidden
    >
      {getCategoryIcon()}
    </div>
  )
}
