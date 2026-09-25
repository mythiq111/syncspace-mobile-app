import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const WEB_PORT = 3000;

// The web app (frontend/) runs on the same machine as Metro. Expo Go already knows
// that machine's LAN address, so we reuse it. Override with EXPO_PUBLIC_WEB_URL
// (e.g. a deployed https URL) when needed.
function resolveWebUrl(): string {
  const override = process.env.EXPO_PUBLIC_WEB_URL;
  if (override) return override;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${WEB_PORT}`;
}

const WEB_URL = resolveWebUrl();

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

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
            <Text style={styles.url}>{WEB_URL}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: WEB_URL }}
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
        )}
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
