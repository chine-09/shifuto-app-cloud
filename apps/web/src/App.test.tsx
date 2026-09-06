import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

describe('App', () => {
  it('renders the nav and the plans dashboard at "/"', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(screen.getByRole('link', { name: 'シフト作成' })).toBeInTheDocument()
    expect(screen.getByText('月を開く / 新規作成')).toBeInTheDocument()
  })
})
