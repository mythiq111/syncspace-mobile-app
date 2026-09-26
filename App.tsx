import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

// The web app (frontend/) runs on the same computer as Metro. Expo Go already knows that computer's
// LAN address, so we reuse it and probe the usual dev ports until one answers with the PulseHR login
// page (so a moved or restarted dev server is found automatically).
// Override with EXPO_PUBLIC_WEB_URL (e.g. a deployed https URL) when needed.
const CANDIDATE_PORTS = [3000, 3001, 3002, 3003, 3004, 3005];

async function findWebUrl(): Promise<string | null> {
  const override = process.env.EXPO_PUBLIC_WEB_URL;
  if (override) return override;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

  const results = await Promise.all(
    CANDIDATE_PORTS.map(async (port) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`http://${host}:${port}/login`, { signal: controller.signal });
        return res.ok ? port : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  const port = results.find((p) => p !== null);
  return port ? `http://${host}:${port}` : null;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumping this re-runs discovery and remounts the WebView

  useEffect(() => {
    let active = true;
    setFailed(false);
    setLoading(true);
    findWebUrl().then((url) => {
      if (!active) return;
      if (url) setWebUrl(url);
      else {
        setFailed(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Always show the latest version: reload whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') webViewRef.current?.reload();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {failed ? (
          <View style={styles.center}>
            <Text style={styles.title}>Can't reach PulseHR</Text>
            <Text style={styles.body}>
              Make sure the web app is running (npm run dev:frontend) and this phone is on the same Wi-Fi as your computer.
            </Text>
            <Text style={styles.url}>Looked for it on ports {CANDIDATE_PORTS[0]}–{CANDIDATE_PORTS[CANDIDATE_PORTS.length - 1]}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : webUrl ? (
          <WebView
            key={`${webUrl}-${attempt}`}
            ref={webViewRef}
            source={{ uri: webUrl }}
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            geolocationEnabled
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) setFailed(true);
            }}
            onNavigationStateChange={onNavigationStateChange}
            pullToRefreshEnabled
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
          />
        ) : null}
        {loading && !failed && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20 },
  url: { fontSize: 12, color: '#64748b', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  button: { marginTop: 8, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 4 },
  buttonText: { color: '#ffffff', fontWeight: '600' },
});
