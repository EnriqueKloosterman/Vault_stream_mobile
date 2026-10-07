import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/shared/components/state-views';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { MaxContentWidth, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';
import {
  fetchLibrary,
  type ItemType,
  type LibraryItem,
} from '@/shared/services/libraryApi';
import { getApiErrorMessage } from '@/shared/utils/api-error';

const PAGE_SIZE = 20;

const FILTERS: { label: string; value: ItemType | undefined }[] = [
  { label: 'Todo', value: undefined },
  { label: 'Películas', value: 'movie' },
  { label: 'Series', value: 'series' },
];

export function LibraryScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 4 : 2;
  const columns = Math.max(2, numColumns);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<ItemType | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<LibraryItem>>(null);
  const scrollOffsetRef = useRef(0);
  const restoreScrollRef = useRef(false);
  const prevColumnsRef = useRef(columns);
  const requestKey = `${typeFilter ?? 'all'}::${search}`;
  const [prevRequestKey, setPrevRequestKey] = useState(requestKey);
  const hasFocusedRef = useRef(false);

  if (requestKey !== prevRequestKey) {
    setPrevRequestKey(requestKey);
    setLoading(true);
  }

  const loadPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      generationRef.current += 1;
      const generation = generationRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (mode !== 'more') {
        pageRef.current = 1;
      }
      try {
        const page = mode === 'more' ? pageRef.current + 1 : 1;
        const response = await fetchLibrary({
          page,
          limit: PAGE_SIZE,
          type: typeFilter,
          q: search || undefined,
          signal: controller.signal,
        });
        if (generation !== generationRef.current) {
          return;
        }
        pageRef.current = page;
        setTotal(response.total);
        setItems((prev) =>
          mode === 'more' ? [...prev, ...response.items] : response.items,
        );
        setError(null);
      } catch (e) {
        if (generation !== generationRef.current) {
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudo cargar la biblioteca'));
      } finally {
        if (generation === generationRef.current && mode !== 'more') {
          setLoading(false);
        }
      }
    },
    [typeFilter, search],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void loadPage('initial');
    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadPage]);

  // Al volver a la pestaña se refresca: el rescan/enriquecimiento corre en
  // segundo plano y la primera carga quedaría sin posterUrl.
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedRef.current) {
        void loadPage('refresh');
      } else {
        hasFocusedRef.current = true;
      }
    }, [loadPage]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage('refresh');
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || items.length >= total) {
      return;
    }
    setLoadingMore(true);
    try {
      await loadPage('more');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, items.length, total, loadPage]);

  const retry = useCallback(() => {
    setLoading(true);
    void loadPage('initial');
  }, [loadPage]);

  const openItem = useCallback((item: LibraryItem) => {
    if (item.type === 'series') {
      router.push({
        pathname: '/series/[id]',
        params: { id: item.seriesId ?? item._id },
      });
    } else {
      router.push({ pathname: '/item/[id]', params: { id: item._id } });
    }
  }, []);

  // Al cruzar el breakpoint de columnas (rotación/resize) el FlatList se
  // remonta por `key`: marcar para restaurar el scroll cuando el nuevo
  // list mida su contenido.
  useEffect(() => {
    if (prevColumnsRef.current !== columns) {
      prevColumnsRef.current = columns;
      restoreScrollRef.current = true;
    }
  }, [columns]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={listRef}
        key={`columns-${columns}`}
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={columns}
        contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
        columnWrapperStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={() => {
          if (restoreScrollRef.current && scrollOffsetRef.current > 0) {
            restoreScrollRef.current = false;
            listRef.current?.scrollToOffset({
              offset: scrollOffsetRef.current,
              animated: false,
            });
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.textSecondary}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por título…"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Buscar en la biblioteca"
              autoCorrect={false}
              style={[
                styles.search,
                { backgroundColor: colors.backgroundElement, color: colors.text },
              ]}
            />
            <View style={styles.filters}>
              {FILTERS.map((filter) => {
                const selected = typeFilter === filter.value;
                return (
                  <Pressable
                    key={filter.label}
                    onPress={() => setTypeFilter(filter.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? colors.backgroundSelected
                          : colors.backgroundElement,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small">{filter.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {error && items.length > 0 ? (
              <ErrorState
                message={error}
                onRetry={retry}
                style={styles.headerError}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : (
            <EmptyState
              message={
                search || typeFilter
                  ? 'Sin resultados para esa búsqueda'
                  : 'No hay contenido todavía. Abre la app con una sesión iniciada para escanear R2.'
              }
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={styles.footerSpinner}
              color={colors.textSecondary}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.backgroundElement },
              !item.posterUrl && styles.cardFallback,
              pressed && styles.pressed,
            ]}
            onPress={() => openItem(item)}>
            {item.posterUrl ? (
              <Image
                source={{ uri: item.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
                accessible={false}
              />
            ) : null}
            <View style={item.posterUrl ? styles.cardText : undefined}>
              <ThemedText type="smallBold" numberOfLines={2}>
                {item.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.type === 'series' ? 'Serie' : 'Película'}
                {item.year ? ` · ${item.year}` : ''}
              </ThemedText>
            </View>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  listEmpty: { justifyContent: 'flex-start' },
  header: { marginBottom: Spacing.two, gap: Spacing.four },
  headerError: { flexDirection: 'row', paddingVertical: 0 },
  row: { gap: Spacing.three },
  search: {
    borderRadius: 10,
    paddingHorizontal: Spacing.threeAndHalf,
    paddingVertical: Spacing.twoAndHalf,
    fontSize: 16,
  },
  filters: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.threeAndHalf,
    paddingVertical: Spacing.oneAndHalf,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardFallback: {
    padding: Spacing.four,
    minHeight: 110,
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  poster: { width: '100%', height: 150 },
  cardText: { padding: Spacing.three, gap: Spacing.one },
  footerSpinner: { paddingVertical: Spacing.eight },
  pressed: { opacity: 0.6 },
});
