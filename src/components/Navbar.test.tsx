import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Sidebar';
import { AuthProvider } from '../context/AuthContext';

test('renders navigation links', () => {
  render(
    <AuthProvider>
      <Navbar />
    </AuthProvider>,
    { wrapper: MemoryRouter }
  );
  expect(screen.getByText('Home')).toBeInTheDocument();
  expect(screen.getByText('Events')).toBeInTheDocument();
});

test('applies active class to active link', async () => {
  render(
    <AuthProvider>
      <Navbar />
    </AuthProvider>,
    { wrapper: ({ children }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter> }
  );
  const homeLink = screen.getByText('Home');
  expect(homeLink).toHaveClass('text-secondary-coral');
  expect(homeLink).toHaveClass('font-bold');
});