import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the header', () => {
    render(<App />);
    // Header should render as a banner landmark
    const header = screen.getByRole('banner');
    expect(header).toBeTruthy();
  });
});
