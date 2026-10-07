import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { SeriesDetailScreen } from '@/features/series/SeriesDetailScreen';
import {
  fetchSeries,
  type SeriesDetailResponse,
} from '@/shared/services/libraryApi';
import { fetchProgress } from '@/shared/services/progressApi';

const mockStart = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/shared/services/libraryApi', () => ({
  fetchSeries: jest.fn(),
  fetchLibraryItem: jest.fn(),
  presignVideo: jest.fn(),
  presignSubtitle: jest.fn(),
}));
jest.mock('@/shared/services/progressApi', () => ({ fetchProgress: jest.fn() }));
jest.mock('@/shared/services/download-manager', () => ({
  useDownloadsStore: {
    getState: () => ({ start: mockStart }),
  },
}));

const detail: SeriesDetailResponse = {
  series: { _id: 's1', title: 'Serie de prueba', year: 2024 },
  seasons: [
    {
      season: 1,
      episodes: [
        {
          _id: 'ep1',
          title: 'Piloto',
          number: 1,
          r2Key: 'videos/ep1.mp4',
          seasonId: 'se1',
          seriesId: 's1',
        },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(fetchSeries).mockResolvedValue(detail);
  jest.mocked(fetchProgress).mockResolvedValue([]);
  mockStart.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SeriesDetailScreen — descarga de episodios', () => {
  it('un fallo de descarga se ve en la fila, sin romper la lista ni navegar', async () => {
    render(<SeriesDetailScreen id="s1" />);

    const button = await screen.findByLabelText('Descargar Piloto');
    mockStart.mockRejectedValue(new Error('Network Error'));

    fireEvent.press(button);

    expect(await screen.findByText('No se pudo iniciar la descarga')).toBeOnTheScreen();
    expect(screen.getByText('Piloto')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('la descarga en curso se refleja en la fila y bloquea el doble toque', async () => {
    render(<SeriesDetailScreen id="s1" />);

    const button = await screen.findByLabelText('Descargar Piloto');
    mockStart.mockReturnValue(new Promise(() => {}));

    fireEvent.press(button);

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(
      screen.getByLabelText('Descargar Piloto').props.accessibilityState?.disabled,
    ).toBe(true);
    expect(screen.queryByText('No se pudo iniciar la descarga')).toBeNull();
  });

  it('la fila del episodio es un botón con pista que navega al reproductor', async () => {
    render(<SeriesDetailScreen id="s1" />);

    const row = await screen.findByHintText('Reproduce el episodio');
    fireEvent.press(row);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/player/[id]',
      params: expect.objectContaining({ id: 'ep1', itemType: 'episode' }),
    });
  });

  it('una serie sin episodios muestra un estado vacío', async () => {
    jest.mocked(fetchSeries).mockResolvedValue({
      series: { _id: 's1', title: 'Serie vacía', year: 2024 },
      seasons: [],
    });

    render(<SeriesDetailScreen id="s1" />);

    expect(
      await screen.findByText('Esta serie no tiene episodios todavía.'),
    ).toBeOnTheScreen();
    expect(screen.queryByHintText('Reproduce el episodio')).toBeNull();
  });

  it('sin stillUrl el capítulo mantiene su etiqueta E{numero}', async () => {
    render(<SeriesDetailScreen id="s1" />);

    expect(await screen.findByText('E01')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('muestra carátula de cabecera y miniatura del capítulo cuando existen', async () => {
    jest.mocked(fetchSeries).mockResolvedValue({
      series: {
        _id: 's1',
        title: 'Serie con portada',
        year: 2024,
        backdropUrl: 'https://x.test/backdrop.jpg',
        posterUrl: 'https://x.test/poster.jpg',
        synopsis: 'Sinopsis de prueba.',
      },
      seasons: [
        {
          season: 1,
          episodes: [
            {
              _id: 'ep1',
              title: 'Piloto',
              number: 1,
              r2Key: 'videos/ep1.mp4',
              seasonId: 'se1',
              seriesId: 's1',
              stillUrl: 'https://x.test/still.jpg',
            },
          ],
        },
      ],
    });

    render(<SeriesDetailScreen id="s1" />);

    expect(await screen.findByText('Sinopsis de prueba.')).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(2);
    expect(screen.queryByText('E01')).toBeNull();
  });
});
