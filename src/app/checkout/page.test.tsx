import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage, { metadata } from './page';

// Keep the real checkout page, steps and order review. Replace only external
// dependencies (cart persistence, payments and global navigation).
const cart = vi.hoisted(() => ({
  hydrated: true,
  items: [] as Array<{
    courseId: string;
    course: {
      title: string;
      price: number;
      category: string;
      thumbnailUrl: null;
      instructor: { name: string };
    };
    addedAt: string;
  }>,
  clearCart: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@/lib/hooks/use-cart-store', () => ({
  useCartHydrated: () => cart.hydrated,
  useCartStore: () => ({
    items: cart.items,
    getTotalPrice: () => cart.items.reduce((sum, item) => sum + item.course.price, 0),
    clearCart: cart.clearCart,
    removeItem: cart.removeItem,
  }),
}));
vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <header data-testid="site-header">SorobanLard</header>,
}));
vi.mock('@/components/checkout/StripeProvider', () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/checkout/PaymentForm', () => ({
  PaymentForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess}>Complete test payment</button>
  ),
}));
vi.mock('@/components/checkout/ConfirmationStep', () => ({
  ConfirmationStep: ({ receipt }: { receipt: { transactionId: string } }) => (
    <section aria-label="Order confirmation">Confirmed: {receipt.transactionId}</section>
  ),
}));

const sampleItem = {
  courseId: 'course-1',
  course: {
    title: 'Tailoring Fundamentals',
    price: 25,
    category: 'Fashion',
    thumbnailUrl: null,
    instructor: { name: 'Ada' },
  },
  addedAt: '2026-11-23T10:00:00Z',
};

beforeEach(() => {
  cart.hydrated = true;
  cart.items = [];
  cart.clearCart.mockClear();
  cart.removeItem.mockClear();
});

describe('CheckoutPage (#408)', () => {
  it('exports page metadata and renders the site layout', () => {
    render(<CheckoutPage />);
    expect(metadata).toMatchObject({ title: 'Checkout' });
    expect(screen.getByTestId('site-header')).toHaveTextContent('SorobanLard');
    expect(screen.getByRole('navigation', { name: 'Checkout progress' })).toBeInTheDocument();
  });

  it('shows a loading placeholder until the persisted cart hydrates', () => {
    cart.hydrated = false;
    render(<CheckoutPage />);

    expect(screen.getByText('Loading your cart…')).toBeInTheDocument();
    expect(screen.queryByText("There's nothing to pay for")).not.toBeInTheDocument();
  });

  it('shows an empty-cart message with a browse-courses CTA', () => {
    render(<CheckoutPage />);

    expect(screen.getByRole('heading', { name: "There's nothing to pay for" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/courses');
  });

  it('shows a cart, advances to payment, returns to review and confirms payment', () => {
    cart.items = [sampleItem];
    render(<CheckoutPage />);

    expect(screen.getByRole('heading', { name: 'Review your order' })).toBeInTheDocument();
    expect(screen.getByText('Tailoring Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Price breakdown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Payment' }));
    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order summary' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to order review' }));
    expect(screen.getByRole('heading', { name: 'Review your order' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete test payment' }));
    expect(screen.getByRole('region', { name: 'Order confirmation' })).toHaveTextContent('Confirmed: txn_');
    expect(cart.clearCart).toHaveBeenCalledOnce();
  });

  it('shows a validation error for an invalid promo code without advancing', async () => {
    cart.items = [sampleItem];
    vi.useFakeTimers();
    try {
      render(<CheckoutPage />);
      fireEvent.change(screen.getByPlaceholderText('Enter promo code'), { target: { value: 'NOTVALID' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await act(async () => { await vi.advanceTimersByTimeAsync(800); });
      expect(screen.getByText(/Invalid or expired promo code/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Review your order' })).toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
