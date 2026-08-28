import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../Home.jsx';

describe('Home', () => {
    it('zeigt Willkommensnachricht', () => {
        render(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Willkommen im SongManager');
    });
});
