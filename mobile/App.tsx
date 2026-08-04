import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoBridge from './bridge/NativeBridge';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getWebAppUrl = () => {
  return 'https://youfi.vercel.app';
};

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const bridgeRef = useRef<ExpoBridge | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState(getWebAppUrl());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await AsyncStorage.setItem('youfi_mobile_initialized', 'true');
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[App] Notification permissions were not granted');
        }
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (token) {
          await AsyncStorage.setItem('youfi_push_token', token);
        }
      } catch (error) {
        console.warn('[App] Initial setup failed', error);
      } finally {
        setIsReady(true);
      }
    };

    init();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  const setWebViewRef = (ref: WebView | null) => {
    webviewRef.current = ref;
    if (ref && !bridgeRef.current) {
      bridgeRef.current = new ExpoBridge(ref);
    }
  };

  const handleWebViewMessage = (event: any) => {
    bridgeRef.current?.handleWebMessage(event);
  };

  const injectBridgeScript = () => {
    return `
      window.YouFINativeBridge = {
        isNativeSupported: true,
        async getPremiumStatus() {
          return new Promise((resolve) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'getPremiumStatus' }));
            window.__pendingPremiumResolve = resolve;
          });
        },
        async purchasePremium(planId) {
          return new Promise((resolve) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'purchasePremium', planId }));
            window.__pendingPremiumResolve = resolve;
          });
        },
        async getPushToken() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'getPushToken' }));
          return 'pending';
        },
        async schedulePaymentNotifications(instances, title) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'schedulePaymentNotifications', instances, title }));
          return [];
        },
        async cancelNotification(instanceId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancelNotification', instanceId }));
        },
        async cancelAllNotifications() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancelAllNotifications' }));
        },
        async syncToCalendar(instances, title) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'syncToCalendar', instances, title }));
          return true;
        },
        async removeFromCalendar(instanceIds) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'removeFromCalendar', instanceIds }));
        },
        async scanReceipt() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scanReceipt' }));
          return null;
        },
        async scanProductImage() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scanProductImage' }));
          return null;
        },
        async showRewardedAd() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'showRewardedAd' }));
          return { reward: 0 };
        },
        async showInterstitialAd() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'showInterstitialAd' }));
          return true;
        },
        log(message) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message }));
        }
      };

      window.onNativeMessage = (message) => {
        if (window.__pendingPremiumResolve && message && message.type === 'premiumStatusChanged') {
          window.__pendingPremiumResolve(message.payload?.isPremium ?? false);
          window.__pendingPremiumResolve = null;
        }
        if (window.__pendingRewardResolve && message && message.type === 'rewardedAdCompleted') {
          window.__pendingRewardResolve(message.payload || { reward: 0 });
          window.__pendingRewardResolve = null;
        }
      };

      true;
    `;
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <Image source={require('./assets/icon.png')} style={styles.logo} />
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Image source={require('./assets/icon.png')} style={styles.logo} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      <WebView
        ref={setWebViewRef}
        source={{ uri: webAppUrl }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        onError={() => {
          setErrorMessage('The web app could not be loaded. Please check the connection and try again.');
          setWebAppUrl('https://youfi.app');
        }}
        injectedJavaScript={injectBridgeScript()}
        injectedJavaScriptBeforeContentLoaded={injectBridgeScript()}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        originWhitelist={['*']}
        allowsBackForwardNavigationGestures
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <Image source={require('./assets/icon.png')} style={styles.logo} />
            <ActivityIndicator size="large" color="#1d4ed8" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
  },
});
