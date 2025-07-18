import { render, screen } from '@testing-library/react';
import App from '../App.jsx';

test('zeigt SongManager im Header', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 6, name: /SongManager/i });
    expect(heading).toBeInTheDocument();
});
