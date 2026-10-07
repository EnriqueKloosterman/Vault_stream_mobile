import { fireEvent, render, screen, act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PlayerScreen } from '@/features/player/PlayerScreen';
import { findLocalPlaybackFile } from '@/shared/services/download-manager';
import {
  fetchLibraryItem,
  presignVideo,
} from '@/shared/services/libraryApi';
import { sendProgress } from '@/shared/services/progressApi';
import { useProgressQueueStore } from '@/shared/store/progress-queue';

type Listener = (payload: unknown) => void;

const mockListeners = new Map<string, Listener[]>();

const mockPlayer = {
  status: 'idle',
  released: false,
  get duration(): number {
    if (this.released) {
      throw new Error('Cannot use shared object that was already released');
    }
    return 60;
  },
  timeUpdateEventInterval: 0.5,
  replaceAsync: jest.fn().mockResolvedValue(undefined),
  play: jest.fn(),
  seekBy: jest.fn(),
  addListener: jest.fn((name: string, listener: Listener) => {
    mockListeners.set(name, [...(mockListeners.get(name) ?? []), listener]);
    return { remove: jest.fn() };
  }),
};

const emit = (name: string, payload: unknown) => {
  for (const listener of mockListeners.get(name) ?? []) {
    listener(payload);
  }
};

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockVideoViewProps: {
  onFullscreenEnter?: () => void;
  onFullscreenExit?: () => void;
} = {};

jest.mock('expo-video', () => ({
  useVideoPlayer: () => mockPlayer,
  VideoView: (props: Record<string, unknown>) => {
    Object.assign(mockVideoViewProps, props);
    return null;
  },
}));
jest.mock('@/shared/services/libraryApi', () => ({
  fetchLibraryItem: jest.fn(),
  presignVideo: jest.fn(),
  presignSubtitle: jest.fn(),
}));
jest.mock('@/shared/services/download-manager', () => ({
  findLocalPlaybackFile: jest.fn(),
}));
jest.mock('@/shared/services/progressApi', () => ({
  sendProgress: jest.fn(),
}));

const item = {
  _id: '1',
  type: 'movie' as const,
  title: 'Película',
  r2Key: 'videos/1.mp4',
  watched: false,
};

const hasSpinner = () =>
  JSON.stringify(screen.toJSON() ?? '').includes('ActivityIndicator');

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockPlayer.status = 'idle';
  mockPlayer.released = false;
  useProgressQueueStore.setState({ queue: [] });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(findLocalPlaybackFile).mockResolvedValue(null);
  jest.mocked(presignVideo).mockResolvedValue({ url: 'https://cdn/video', expiresIn: 300 });
  jest.mocked(sendProgress).mockResolvedValue({ updated: 0, skipped: 0 });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PlayerScreen — caminos de error', () => {
  it('sin r2Key y fallo de red muestra error con Reintentar, no un spinner infinito', async () => {
    jest.mocked(fetchLibraryItem).mockRejectedValue(new Error('Network Error'));

    render(<PlayerScreen id="1" />);

    expect(await screen.findByText('No se pudo obtener el vídeo')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
    expect(hasSpinner()).toBe(false);
  });

  it('item sin r2Key muestra error en vez de girar para siempre', async () => {
    jest.mocked(fetchLibraryItem).mockResolvedValue({ ...item, r2Key: '' });

    render(<PlayerScreen id="1" />);

    expect(
      await screen.findByText('Este contenido no tiene vídeo disponible'),
    ).toBeOnTheScreen();
    expect(hasSpinner()).toBe(false);
  });

  it('Reintentar vuelve a pedir el vídeo y recupera tras un fallo', async () => {
    jest.mocked(fetchLibraryItem)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(item);

    render(<PlayerScreen id="1" />);
    await screen.findByText('No se pudo obtener el vídeo');

    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(mockPlayer.play).toHaveBeenCalled();
    });
    expect(presignVideo).toHaveBeenCalledWith('videos/1.mp4');
    expect(screen.queryByText('No se pudo obtener el vídeo')).toBeNull();
  });

  it('el error del reproductor se muestra en español, no el texto crudo del sistema', async () => {
    render(<PlayerScreen id="1" r2Key="videos/1.mp4" title="Película" />);

    await waitFor(() => {
      expect(mockPlayer.play).toHaveBeenCalled();
    });
    expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://cdn/video');

    act(() => {
      emit('statusChange', {
        status: 'error',
        error: new Error('The operation could not be completed. (AVFoundationErrorDomain error 11800.)'),
      });
    });

    expect(await screen.findByText('No se pudo reproducir el vídeo')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
    expect(screen.queryByText(/AVFoundationErrorDomain/)).toBeNull();
  });
});

describe('PlayerScreen — barra superior', () => {
  it('el botón cerrar es accesible y navega hacia atrás', async () => {
    render(<PlayerScreen id="1" r2Key="videos/1.mp4" title="Película" />);
    await waitFor(() => {
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Cerrar reproductor' }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('el interruptor de subtítulos expone su estado seleccionable', async () => {
    render(<PlayerScreen id="1" r2Key="videos/1.mp4" title="Película" />);
    await waitFor(() => {
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    const toggle = screen.getByRole('button', { name: 'Subtítulos' });
    expect(toggle).toBeSelected();

    fireEvent.press(toggle);

    expect(screen.getByRole('button', { name: 'Subtítulos' })).not.toBeSelected();
  });

  it('la barra se oculta sola y vuelve al tocar la zona superior', async () => {
    jest.useFakeTimers();
    render(<PlayerScreen id="1" r2Key="videos/1.mp4" title="Película" />);
    await act(async () => {});

    expect(screen.getByRole('button', { name: 'Cerrar reproductor' })).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(4500);
    });

    expect(screen.queryByRole('button', { name: 'Cerrar reproductor' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subtítulos' })).toBeNull();

    fireEvent.press(
      screen.getByRole('button', { name: 'Mostrar controles del reproductor' }),
    );

    expect(screen.getByRole('button', { name: 'Cerrar reproductor' })).toBeOnTheScreen();
  });

  it('en pantalla completa la barra se oculta y vuelve al salir', async () => {
    jest.useFakeTimers();
    render(<PlayerScreen id="1" r2Key="videos/1.mp4" title="Película" />);
    await act(async () => {});

    act(() => {
      mockVideoViewProps.onFullscreenEnter?.();
    });
    expect(screen.queryByRole('button', { name: 'Cerrar reproductor' })).toBeNull();

    act(() => {
      mockVideoViewProps.onFullscreenExit?.();
    });
    expect(screen.getByRole('button', { name: 'Cerrar reproductor' })).toBeOnTheScreen();
  });
});

describe('PlayerScreen — progreso', () => {
  it('vuelca el progreso al desmontar', async () => {
    const { unmount } = render(
      <PlayerScreen id="1" r2Key="videos/1.mp4" itemType="movie" />,
    );

    act(() => {
      emit('timeUpdate', { currentTime: 2 });
    });
    unmount();

    await waitFor(() => {
      expect(sendProgress).toHaveBeenCalledWith([
        expect.objectContaining({
          itemType: 'movie',
          refId: '1',
          currentTimeSec: 2,
          completedPct: 3,
        }),
      ]);
    });
  });

  it('no manda progreso si nunca avanzó el vídeo', async () => {
    const { unmount } = render(
      <PlayerScreen id="1" r2Key="videos/1.mp4" itemType="movie" />,
    );

    unmount();

    expect(sendProgress).not.toHaveBeenCalled();
  });

  it('el vuelco al desmontar no lee el reproductor (puede estar liberado ya)', async () => {
    const { unmount } = render(
      <PlayerScreen id="1" r2Key="videos/1.mp4" itemType="movie" />,
    );

    act(() => {
      emit('timeUpdate', { currentTime: 2 });
    });
    mockPlayer.released = true;

    unmount();

    await waitFor(() => {
      expect(sendProgress).toHaveBeenCalledWith([
        expect.objectContaining({
          itemType: 'movie',
          refId: '1',
          currentTimeSec: 2,
        }),
      ]);
    });
  });
});
