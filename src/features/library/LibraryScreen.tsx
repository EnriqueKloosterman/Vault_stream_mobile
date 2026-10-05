import { router } from 'expo-router';
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

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
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

  const loadPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      try {
        const page = mode === 'more' ? pageRef.current + 1 : 1;
        const response = await fetchLibrary({
          page,
          limit: PAGE_SIZE,
          type: typeFilter,
          q: search || undefined,
        });
        pageRef.current = page;
        setTotal(response.total);
        setItems((prev) =>
          mode === 'more' ? [...prev, ...response.items] : response.items,
        );
        setError(null);
      } catch (e) {
        if (mode !== 'more') {
          setError(getApiErrorMessage(e, 'No se pudo cargar la biblioteca'));
        }
      } finally {
        if (mode !== 'more') {
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
    pageRef.current = 1;
    void loadPage('initial');
  }, [loadPage]);

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

  const columns = Math.max(2, numColumns);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        key={`columns-${columns}`}
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={columns}
        contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
        columnWrapperStyle={styles.row}
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
            <ThemedText type="subtitle">Biblioteca</ThemedText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por título…"
              placeholderTextColor={colors.textSecondary}
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
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? colors.backgroundSelected
                          : colors.backgroundElement,
                      },
                    ]}>
                    <ThemedText type="small">{filter.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {error && items.length > 0 ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.centered} color={colors.textSecondary} />
          ) : error ? (
            <View style={styles.centered}>
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
              <Pressable onPress={retry} style={styles.retry}>
                <ThemedText type="link">Reintentar</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centered}>
              <ThemedText type="small" themeColor="textSecondary">
                {search || typeFilter
                  ? 'Sin resultados para esa búsqueda'
                  : 'No hay contenido todavía. Abre la app con una sesión iniciada para escanear R2.'}
              </ThemedText>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.centered} color={colors.textSecondary} />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.backgroundElement }]}
            onPress={() => openItem(item)}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {item.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.type === 'series' ? 'Serie' : 'Película'}
              {item.year ? ` · ${item.year}` : ''}
            </ThemedText>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  listEmpty: { justifyContent: 'flex-start' },
  header: { marginBottom: 8, gap: 12 },
  row: { gap: 12 },
  search: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 110,
    justifyContent: 'flex-end',
    gap: 4,
  },
  centered: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  retry: { paddingVertical: 8, paddingHorizontal: 12 },
});
