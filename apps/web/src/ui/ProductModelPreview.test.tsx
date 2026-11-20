import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRODUCT_CATALOG_SEED } from '../catalog/productCatalog';
import { ProductModelPreview } from './ProductModelPreview';

function seed(index: number) {
  const product = PRODUCT_CATALOG_SEED[index];
  if (!product) throw new Error('Missing seeded model');
  return product;
}

describe('catalog preview from existing 3D geometry', () => {
  it('projects all 16 seeded models without any second canvas', () => {
    const { container, rerender } = render(<ProductModelPreview product={seed(0)} />);
    for (const product of PRODUCT_CATALOG_SEED) {
      rerender(<ProductModelPreview key={product.sku} product={product} />);
      const projected = container.querySelector('.pc-model-surface svg');
      expect(projected?.getAttribute('viewBox')).toBe('-200 -150 400 300');
      expect(projected?.querySelectorAll('path').length).toBeGreaterThan(0);
      expect(projected?.innerHTML).not.toMatch(/NaN|Infinity/);
      expect(container.querySelectorAll('.pc-model-surface svg')).toHaveLength(1);
      expect(container.querySelector('canvas')).toBeNull();
    }
  });

  it('changes the actual projection on orbit and supports keyboard reset', () => {
    const { container } = render(<ProductModelPreview product={seed(3)} />);
    const meshSvg = () => container.querySelector('.pc-model-surface svg')?.innerHTML;
    const initial = meshSvg();
    expect(initial).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '向右旋转模型' }));
    expect(meshSvg()).not.toBe(initial);
    fireEvent.keyDown(screen.getByRole('group', { name: /模型视角/ }), { key: 'Home' });
    expect(meshSvg()).toBe(initial);
  });
});
