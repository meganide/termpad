import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShellIcon } from './ShellIcon';

describe('ShellIcon', () => {
  describe('rendering', () => {
    it('renders an img element', () => {
      render(<ShellIcon shellId="bash" />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has alt text with shell name', () => {
      render(<ShellIcon shellId="zsh" />);
      expect(screen.getByAltText('zsh shell icon')).toBeInTheDocument();
    });

    it('renders with a valid src attribute', () => {
      render(<ShellIcon shellId="bash" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src');
      // In test mode, Vite inlines SVGs as data URIs
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    });
  });

  describe('known shell icons', () => {
    const knownShells = [
      'powershell',
      'cmd',
      'bash',
      'zsh',
      'fish',
      'git-bash',
      'ubuntu',
      'arch',
      'debian',
      'generic',
    ];

    it.each(knownShells)('renders %s icon with a valid SVG data URI', (shellId) => {
      render(<ShellIcon shellId={shellId} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src');
      // All known shells should render with SVG data URIs
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
      expect(screen.getByAltText(`${shellId} shell icon`)).toBeInTheDocument();
    });
  });

  describe('fallback to generic icon', () => {
    it('uses generic icon for unknown shell ID', () => {
      render(<ShellIcon shellId="unknown-shell" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src');
      // Should still render with a valid SVG data URI (the generic icon)
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
      expect(screen.getByAltText('unknown-shell shell icon')).toBeInTheDocument();
    });

    it('uses generic icon for empty shell ID', () => {
      render(<ShellIcon shellId="" />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    });

    it('renders correctly when given a completely unknown shell', () => {
      render(<ShellIcon shellId="some-random-shell-xyz" />);
      const img = screen.getByRole('img');
      // Should still render (using generic fallback)
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    });
  });

  describe('props', () => {
    it('applies custom className', () => {
      render(<ShellIcon shellId="bash" className="custom-class" />);
      const img = screen.getByRole('img');
      expect(img).toHaveClass('custom-class');
    });

    it('uses default size of 16', () => {
      render(<ShellIcon shellId="bash" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('width', '16');
      expect(img).toHaveAttribute('height', '16');
    });

    it('applies custom size', () => {
      render(<ShellIcon shellId="bash" size={24} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('width', '24');
      expect(img).toHaveAttribute('height', '24');
    });

    it('applies inline-block display style', () => {
      render(<ShellIcon shellId="bash" />);
      const img = screen.getByRole('img');
      expect(img).toHaveStyle({ display: 'inline-block' });
    });
  });
});
