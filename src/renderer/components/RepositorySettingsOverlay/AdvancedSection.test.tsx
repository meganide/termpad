import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdvancedSection } from './AdvancedSection';
import type { RepositoryScriptsConfig } from '../../../shared/types';

function createDefaultConfig(): RepositoryScriptsConfig {
  return {
    setupScript: null,
    runScripts: [],
    cleanupScript: null,
    exclusiveMode: false,
    lastUsedRunScriptId: null,
  };
}

describe('AdvancedSection', () => {
  describe('rendering', () => {
    it('renders advanced section', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByTestId('advanced-section')).toBeInTheDocument();
    });

    it('renders exclusive mode checkbox', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByTestId('exclusive-mode-checkbox')).toBeInTheDocument();
      expect(screen.getByLabelText('Exclusive Mode')).toBeInTheDocument();
    });

    it('renders exclusive mode description', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText(/kill any existing instances/i)).toBeInTheDocument();
    });
  });

  describe('exclusive mode toggle', () => {
    it('checkbox is unchecked by default', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      const checkbox = screen.getByTestId('exclusive-mode-checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('checkbox reflects scriptsConfig.exclusiveMode value', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), exclusiveMode: true };
      render(<AdvancedSection scriptsConfig={config} onUpdate={onUpdate} />);

      const checkbox = screen.getByTestId('exclusive-mode-checkbox');
      expect(checkbox).toBeChecked();
    });

    it('calls onUpdate when checkbox is clicked', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByTestId('exclusive-mode-checkbox'));

      expect(onUpdate).toHaveBeenCalledWith({ exclusiveMode: true });
    });

    it('calls onUpdate with false when unchecking', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), exclusiveMode: true };
      render(<AdvancedSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByTestId('exclusive-mode-checkbox'));

      expect(onUpdate).toHaveBeenCalledWith({ exclusiveMode: false });
    });

    it('label is clickable and toggles checkbox', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      // Click the label instead of the checkbox
      fireEvent.click(screen.getByText('Exclusive Mode'));

      expect(onUpdate).toHaveBeenCalledWith({ exclusiveMode: true });
    });
  });

  describe('accessibility', () => {
    it('checkbox has proper label association', () => {
      const onUpdate = vi.fn();
      render(<AdvancedSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      // getByLabelText will find the checkbox by its label (shadcn Checkbox uses role="checkbox")
      const checkbox = screen.getByLabelText('Exclusive Mode');
      expect(checkbox).toHaveAttribute('role', 'checkbox');
      expect(checkbox).toHaveAttribute('id', 'exclusive-mode');
    });
  });
});
