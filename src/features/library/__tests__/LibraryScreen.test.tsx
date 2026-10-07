import { Image } from 'expo-image';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ActivityIndicator, FlatList } from 'react-native';

import { LibraryScreen } from '@/features/library/LibraryScreen';
import { fetchLibrary } from '@/shared/services/libraryApi';
import type { LibraryListResponse } from '@/shared/services/libraryApi';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('@/shared/services/libraryApi', () => ({
  fetchLibrary: jest.fn(),
}));

const hasSpinner = () =>
  screen.UNSAFE_queryAllByType(ActivityIndicator).length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(fetchLibrary).mockResolvedValue({
    total: 0,
    items: [],
    page: 1,
    limit: 20,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LibraryScreen — accesibilidad', () => {
  it('los chips exponen rol de botón y estado seleccionado', async () => {
    render(<LibraryScreen />);

    const all = await screen.findByRole('button', { name: 'Todo' });
    expect(all).toBeSelected();
    expect(screen.getByRole('button', { name: 'Películas' })).not.toBeSelected();

    fireEvent.press(screen.getByRole('button', { name: 'Películas' }));

    await waitFor(() => {
      expect(fetchLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'movie' }),
      );
    });
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Películas' })).toBeSelected();
  });

  it('la lista no cierra el teclado con el primer toque', async () => {
    render(<LibraryScreen />);
    await act(async () => {});

    expect(
      screen.UNSAFE_getByType(FlatList).props.keyboardShouldPersistTaps,
    ).toBe('handled');
  });

  it('un fallo de carga muestra un Reintentar accesible', async () => {
    jest.mocked(fetchLibrary).mockRejectedValueOnce(new Error('Network Error'));

    render(<LibraryScreen />);

    expect(await screen.findByText('No se pudo cargar la biblioteca')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(fetchLibrary).toHaveBeenCalledTimes(2);
    });
    await act(async () => {});
  });
});

describe('LibraryScreen — estados de lista', () => {
  it('al cambiar el filtro muestra el indicador en vez de "sin resultados"', async () => {
    render(<LibraryScreen />);
    expect(await screen.findByText(/No hay contenido todavía/)).toBeOnTheScreen();

    let resolveSecond!: (value: LibraryListResponse) => void;
    jest.mocked(fetchLibrary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    fireEvent.press(screen.getByRole('button', { name: 'Películas' }));

    await waitFor(() => {
      expect(hasSpinner()).toBe(true);
    });
    expect(screen.queryByText(/No hay contenido todavía/)).toBeNull();

    resolveSecond({ total: 0, items: [], page: 1, limit: 20 });
    await act(async () => {});
    expect(await screen.findByText('Sin resultados para esa búsqueda')).toBeOnTheScreen();
  });

  it('una respuesta lenta de un filtro anterior no pisa los resultados nuevos', async () => {
    let resolveFirst!: (value: LibraryListResponse) => void;
    jest.mocked(fetchLibrary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    render(<LibraryScreen />);

    jest.mocked(fetchLibrary).mockResolvedValueOnce({
      total: 1,
      items: [
        { _id: 'l2', type: 'series', title: 'Nueva serie', r2Key: 'k2', watched: false },
      ],
      page: 1,
      limit: 20,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Series' }));

    expect(await screen.findByText('Nueva serie')).toBeOnTheScreen();

    resolveFirst({
      total: 1,
      items: [
        { _id: 'l1', type: 'movie', title: 'Película vieja', r2Key: 'k1', watched: false },
      ],
      page: 1,
      limit: 20,
    });
    await act(async () => {});

    expect(screen.queryByText('Película vieja')).toBeNull();
    expect(screen.getByText('Nueva serie')).toBeOnTheScreen();
    expect(
      jest.mocked(fetchLibrary).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
  });

  it('muestra el póster cuando hay posterUrl y mantiene la caja de texto si no', async () => {
    jest.mocked(fetchLibrary).mockResolvedValue({
      total: 2,
      items: [
        {
          _id: 'p1',
          type: 'movie',
          title: 'Con póster',
          year: 2010,
          r2Key: 'k1',
          watched: false,
          posterUrl: 'https://image.tmdb.org/t/p/w500/x.jpg',
        },
        { _id: 'p2', type: 'movie', title: 'Sin póster', r2Key: 'k2', watched: false },
      ],
      page: 1,
      limit: 20,
    });

    render(<LibraryScreen />);

    expect(await screen.findByText('Con póster')).toBeOnTheScreen();

    const posters = screen.UNSAFE_queryAllByType(Image);
    expect(posters).toHaveLength(1);
    expect(posters[0].props.source).toEqual({
      uri: 'https://image.tmdb.org/t/p/w500/x.jpg',
    });
    await act(async () => {});
  });

  it('el fallo de "cargar más" se muestra con Reintentar y sin spinner colgado', async () => {
    jest.mocked(fetchLibrary).mockResolvedValue({
      total: 100,
      items: [
        { _id: 'l1', type: 'movie', title: 'Película uno', r2Key: 'k', watched: false },
      ],
      page: 1,
      limit: 20,
    });

    render(<LibraryScreen />);
    expect(await screen.findByText('Película uno')).toBeOnTheScreen();

    jest.mocked(fetchLibrary).mockRejectedValueOnce(new Error('Network Error'));
    fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached');

    expect(await screen.findByText('No se pudo cargar la biblioteca')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
    await act(async () => {});
    expect(hasSpinner()).toBe(false);
  });
});
