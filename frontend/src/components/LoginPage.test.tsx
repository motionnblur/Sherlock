import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';

// vi.mock is hoisted to the top of the file, so variables used inside its factory
// must also be hoisted via vi.hoisted to avoid "Cannot access before initialization".
const { mockSubmitLogin, mockUseLogin } = vi.hoisted(() => ({
  mockSubmitLogin: vi.fn(),
  mockUseLogin: vi.fn(),
}));

vi.mock('../hooks/useLogin', () => ({
  useLogin: mockUseLogin,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogin.mockReturnValue({
      isSubmitting: false,
      loginError: null,
      submitLogin: mockSubmitLogin,
    });
  });

  it('renders without crashing', () => {
    render(<LoginPage />);
    
    expect(screen.getByText('SHERLOCK GCS')).toBeInTheDocument();
    expect(screen.getByText('Operator Authentication')).toBeInTheDocument();
    expect(screen.getByText('Authorized personnel only. All access is audited.')).toBeInTheDocument();
  });

  it('renders form inputs', () => {
    render(<LoginPage />);
    
    expect(screen.getByLabelText('Operator ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Access Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('enter operator id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('renders authenticate button', () => {
    render(<LoginPage />);
    
    expect(screen.getByText('AUTHENTICATE')).toBeInTheDocument();
  });

  it('updates username input value', () => {
    render(<LoginPage />);
    
    const usernameInput = screen.getByLabelText('Operator ID');
    fireEvent.change(usernameInput, { target: { value: 'operator1' } });
    
    expect(usernameInput).toHaveValue('operator1');
  });

  it('updates password input value', () => {
    render(<LoginPage />);
    
    const passwordInput = screen.getByLabelText('Access Code');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(passwordInput).toHaveValue('password123');
  });

  it('calls submitLogin with credentials when form is submitted', async () => {
    render(<LoginPage />);
    
    const usernameInput = screen.getByLabelText('Operator ID');
    const passwordInput = screen.getByLabelText('Access Code');
    const submitButton = screen.getByText('AUTHENTICATE');
    
    fireEvent.change(usernameInput, { target: { value: 'operator1' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSubmitLogin).toHaveBeenCalledWith({
        username: 'operator1',
        password: 'password123',
      });
    });
  });

  it('trims username before submitting', async () => {
    render(<LoginPage />);
    
    const usernameInput = screen.getByLabelText('Operator ID');
    const passwordInput = screen.getByLabelText('Access Code');
    const submitButton = screen.getByText('AUTHENTICATE');
    
    fireEvent.change(usernameInput, { target: { value: '  operator1  ' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSubmitLogin).toHaveBeenCalledWith({
        username: 'operator1', // Should be trimmed
        password: 'password123',
      });
    });
  });

  it('disables submit button when isSubmitting is true', () => {
    mockUseLogin.mockReturnValue({
      isSubmitting: true,
      loginError: null,
      submitLogin: mockSubmitLogin,
    });
    
    render(<LoginPage />);
    
    const submitButton = screen.getByText('AUTHENTICATING...');
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when username or password is empty', () => {
    render(<LoginPage />);
    
    const submitButton = screen.getByText('AUTHENTICATE');
    expect(submitButton).toBeDisabled();
    
    // Fill only username
    const usernameInput = screen.getByLabelText('Operator ID');
    fireEvent.change(usernameInput, { target: { value: 'operator1' } });
    
    expect(submitButton).toBeDisabled();
    
    // Fill only password
    fireEvent.change(usernameInput, { target: { value: '' } });
    const passwordInput = screen.getByLabelText('Access Code');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(submitButton).toBeDisabled();
    
    // Fill both
    fireEvent.change(usernameInput, { target: { value: 'operator1' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('shows login error when present', () => {
    mockUseLogin.mockReturnValue({
      isSubmitting: false,
      loginError: 'Authentication failed',
      submitLogin: mockSubmitLogin,
    });
    
    render(<LoginPage />);
    
    expect(screen.getByText('✕ Authentication failed')).toBeInTheDocument();
    expect(screen.getByText('✕ Authentication failed')).toHaveClass('text-danger');
  });

  it('disables inputs when isSubmitting is true', () => {
    mockUseLogin.mockReturnValue({
      isSubmitting: true,
      loginError: null,
      submitLogin: mockSubmitLogin,
    });
    
    render(<LoginPage />);
    
    const usernameInput = screen.getByLabelText('Operator ID');
    const passwordInput = screen.getByLabelText('Access Code');
    
    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
  });

  it('shows authenticating text on button when isSubmitting is true', () => {
    mockUseLogin.mockReturnValue({
      isSubmitting: true,
      loginError: null,
      submitLogin: mockSubmitLogin,
    });
    
    render(<LoginPage />);
    
    expect(screen.getByText('AUTHENTICATING...')).toBeInTheDocument();
    expect(screen.queryByText('AUTHENTICATE')).not.toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<LoginPage />);
    
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass('h-screen', 'flex', 'flex-col', 'items-center', 'justify-center', 'bg-surface', 'font-mono');
    
    // <form> without aria-label is not exposed as role="form"; query it directly
    const formContainer = container.querySelector('form')!.parentElement;
    expect(formContainer).toHaveClass('w-80', 'border', 'border-line', 'bg-panel');
  });

  it('renders footer text', () => {
    render(<LoginPage />);
    
    expect(screen.getByText('Account access administered by system operator.')).toBeInTheDocument();
  });

  it('has autoFocus on username input', () => {
    render(<LoginPage />);

    const usernameInput = screen.getByLabelText('Operator ID');
    // React calls .focus() on mount for autoFocus; the element should be focused
    expect(usernameInput).toHaveFocus();
  });

  it('has proper autocomplete attributes', () => {
    render(<LoginPage />);
    
    const usernameInput = screen.getByLabelText('Operator ID');
    const passwordInput = screen.getByLabelText('Access Code');
    
    expect(usernameInput).toHaveAttribute('autocomplete', 'username');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });
});