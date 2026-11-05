import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CodeInput } from './CodeInput'

function Harness({ onComplete }: { onComplete: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <CodeInput label="Sign-in code" length={6} value={v} onChange={setV} onComplete={onComplete} />
  )
}

describe('CodeInput', () => {
  it('is one labelled field set up for one-time-code autofill', () => {
    render(<Harness onComplete={() => {}} />)
    const input = screen.getByLabelText('Sign-in code')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    // No maxlength, so pasting a whole message still works (digits are extracted).
    expect(input).not.toHaveAttribute('maxlength')
  })

  it('keeps digits only and completes on the 6th digit', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    const input = screen.getByLabelText('Sign-in code')
    fireEvent.change(input, { target: { value: '12a3' } })
    expect(input).toHaveValue('123')
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Your code: 987 654' } })
    expect(input).toHaveValue('987654')
    expect(onComplete).toHaveBeenCalledWith('987654')
  })
})
