import { useState } from 'react'
import { PRODUCT_PLACEHOLDER_SRC } from '../utils/productImage'

export default function ProductAvatar({ product, className = 'h-16 w-16 rounded-lg' }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const hasProductImage = Boolean(product?.imageUrl) && failedSrc !== product?.imageUrl
  const src = hasProductImage ? product.imageUrl : PRODUCT_PLACEHOLDER_SRC

  return (
    <div className={`${className} overflow-hidden bg-slate-50`}>
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain object-center"
        onError={() => {
          if (product?.imageUrl) setFailedSrc(product.imageUrl)
        }}
      />
    </div>
  )
}
