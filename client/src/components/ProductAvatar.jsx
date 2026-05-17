import { useState } from 'react'
import { PRODUCT_PLACEHOLDER_SRC } from '../utils/productImage'

export default function ProductAvatar({ product, className = 'h-16 w-16 rounded-lg' }) {
  const [failed, setFailed] = useState(false)
  const hasProductImage = Boolean(product?.imageUrl) && !failed
  const src = hasProductImage ? product.imageUrl : PRODUCT_PLACEHOLDER_SRC

  return (
    <div className={`${className} overflow-hidden bg-slate-50`}>
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain object-center"
        onError={() => {
          if (hasProductImage) setFailed(true)
        }}
      />
    </div>
  )
}
