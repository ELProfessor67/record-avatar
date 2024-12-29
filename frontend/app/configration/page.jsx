'use client'

import { useCallback, useState } from 'react'
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'




export default function Home() {
  const [input_text, setInput_text] = useState('');
  const router = useRouter()
  const searchParams = useSearchParams();
  const model = searchParams.get('model');



  const handleCLick = useCallback(() => {
    router.push(`/heygen?input_text=${input_text}`)
  },[input_text])

  return (
    
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 space-y-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">AI Model Showcase</h1>
      



      <div className="mb-8">
        <label>Input Text</label>
        <Textarea type='text' placeholder="Prompt" className="w-[30rem] max-w-[30rem] h-[10rem]" value={input_text} onChange={(e) => setInput_text(e.target.value)}/>
      </div>

      <Button onClick={handleCLick}>Connect</Button>

    </main>
  )
}

