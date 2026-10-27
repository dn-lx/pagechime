import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FS from "expo-file-system/legacy";
import { palette } from "@pagechime/core";
export default function NativePdf({
  source,
  page,
  onCount,
  onError,
}: {
  source: number | string;
  page: number;
  onCount?: (n: number) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<WebView<{}>>(null),
    [html, setHtml] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    ready = useRef(false),
    data = useRef(""),
    currentPage = useRef(page);
  currentPage.current = page;
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    setLoading(true);
    setError("");
    (async () => {
      const viewer = Asset.fromModule(
        require("./assets/pdf-viewer.generated.html"),
      );
      await viewer.downloadAsync();
      const pdf = typeof source === "number" ? Asset.fromModule(source) : null;
      if (pdf) await pdf.downloadAsync();
      const uri = pdf?.localUri || pdf?.uri || (source as string);
      const [h, d] = await Promise.all([
        FS.readAsStringAsync(viewer.localUri || viewer.uri),
        FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 }),
      ]);
      if (cancelled) return;
      data.current = d;
      setHtml(h);
    })().catch(() => {
      if (!cancelled) {
        setError("The original PDF could not be opened.");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);
  useEffect(() => {
    if (ready.current)
      ref.current?.injectJavaScript(
        `window.pagechimePDF?.setPage(${page});true;`,
      );
  }, [page]);
  function message(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === "ready") {
        ready.current = true;
        ref.current?.injectJavaScript(
          `window.pagechimePDF.load(${JSON.stringify(data.current)},${currentPage.current});true;`,
        );
      }
      if (m.type === "loaded") onCount?.(m.count);
      if (m.type === "rendered") setLoading(false);
      if (m.type === "error") {
        setError(m.message);
        onError?.(m.message);
        setLoading(false);
      }
    } catch {
      setError("The PDF viewer could not start.");
      setLoading(false);
    }
  }
  return (
    <View style={styles.root}>
      {html && !error && (
        <WebView<{}>
          key={String(source)}
          ref={ref}
          source={{ html, baseUrl: "https://pagechime.local/" }}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(r) =>
            r.url === "about:blank" ||
            r.url === "https://pagechime.local/" ||
            r.url.startsWith("blob:")
          }
          onMessage={message}
          javaScriptEnabled
          domStorageEnabled={false}
          style={styles.web}
          onError={() => {
            setError("The PDF viewer could not load.");
            setLoading(false);
          }}
        />
      )}
      {loading && (
        <View style={styles.wait}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.note}>Opening your page…</Text>
        </View>
      )}
      {error && (
        <View style={styles.wait}>
          <Text style={styles.note}>{error}</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 300, backgroundColor: palette.paper },
  web: { backgroundColor: palette.paper },
  wait: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  note: { color: palette.muted, fontSize: 13 },
});
