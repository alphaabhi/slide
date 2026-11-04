import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityCard } from './ActivityCard'
import { initialOf } from '@/lib/initials'
import { Button } from './Button'
import { Input } from './Field'
import { MessageBubble } from './MessageBubble'

describe('initialOf', () => {
  it('handles latin, non-latin, emoji and empty names', () => {
    expect(initialOf('meera')).toBe('M')
    expect(initialOf('  ølsen')).toBe('Ø')
    expect(initialOf('अनु')).toBe('अ')
    expect(initialOf('🌻 Sunny')).toBe('🌻')
    expect(initialOf('   ')).toBe('?')
  })
})

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    render(<Button loading>Send code</Button>)
    const btn = screen.getByRole('button', { name: /send code/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('icon-only buttons expose their accessible name', () => {
    render(
      <Button iconOnly aria-label="Send message">
        <svg />
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('links its label and error message', () => {
    render(<Input label="Email" error="Enter a valid email." />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email.')
  })
})

describe('MessageBubble', () => {
  it('shows a retry action for failed messages', async () => {
    const onRetry = vi.fn()
    render(
      <MessageBubble
        side="you"
        body="hi"
        time="9:41 pm"
        dateTime="2026-11-04T16:11:00Z"
        status="failed"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText('Not sent')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not show delivery status on their messages', () => {
    render(
      <MessageBubble
        side="them"
        body="hey"
        time="9:41 pm"
        dateTime="2026-11-04T16:11:00Z"
        status="sent"
      />,
    )
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
  })
})

describe('ActivityCard', () => {
  const base = {
    kind: 'would-you-rather' as const,
    prompt: 'Beach or mountains?',
    options: [
      { id: 'a', label: 'Beach' },
      { id: 'b', label: 'Mountains' },
    ],
    youName: 'Abhi',
    themName: 'Meera',
  }

  it('lets you choose once, then waits for the other person', async () => {
    const onChoose = vi.fn()
    const { rerender } = render(<ActivityCard {...base} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: /beach/i }))
    expect(onChoose).toHaveBeenCalledWith('a')

    rerender(<ActivityCard {...base} yourChoice="a" onChoose={onChoose} />)
    expect(screen.getByText('Waiting for Meera to choose')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mountains/i })).toBeDisabled()
  })

  it('never reveals the partner’s pick before both have answered', () => {
    render(<ActivityCard {...base} theyAnswered />)
    expect(screen.getByText('Meera has chosen. Your turn.')).toBeInTheDocument()
    expect(screen.queryByText('Meera', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('reveals both picks once both answered', () => {
    render(<ActivityCard {...base} yourChoice="a" theirChoice="b" />)
    expect(screen.getByText('Different picks. Discuss.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })
})
