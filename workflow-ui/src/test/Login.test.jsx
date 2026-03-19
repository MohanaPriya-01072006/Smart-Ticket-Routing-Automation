import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from '../components/Login';

describe('Login Component', () => {
  it('should render login form', () => {
    render(<Login onLoginSuccess={() => {}} onSwitchToRegister={() => {}} />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should allow input change', () => {
    render(<Login onLoginSuccess={() => {}} onSwitchToRegister={() => {}} />);
    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput.value).toBe('test@example.com');
  });
});
