/**
 * Expo App.tsx - React Native wrapper with WebView bridge
 * Place this in: mobile/App.tsx
 */

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, BackHandler, Alert, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoBridge from './bridge/NativeBridge';
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [nativeBridge, setNativeBridge] = useState<ExpoBridge | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setupApp();
    setupBackHandler();
  }, []);

  const setupApp = async () => {
    try {
      // Check premium status
      const premiumStatus = await AsyncStorage.getItem('youfi_premium');
      setIsPremium(premiumStatus === 'true');

      // Get initial data
      const pushToken = await Notifications.getExpoPushTokenAsync();
      console.log('[App] Push token:', pushToken.data);

      setIsReady(true);
    } catch (error) {
      console.error('[App] Setup failed:', error);
    }
  };

  const setupBackHandler = () => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (webviewRef.current) {
          webviewRef.current.goBack();
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  };

  const handleWebViewMessage = (event: any) => {
    if (nativeBridge) {
      nativeBridge.handleWebMessage(event);
    }
  };

  const injectBridgeScript = () => {
    return `
      window.YouFINativeBridge = {
        isNativeSupported: true,
        
        // Premium
        async getPremiumStatus() {
          return new Promise((resolve) => {
            window.NativeBridgeCallback = (result) => {
              resolve(result.payload.status);
              delete window.NativeBridgeCallback;
            };
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'getPremiumStatus',
              callbackId: Date.now().toString()
            }));
          });
        },

        async purchasePremium(planId) {
          return new Promise((resolve, reject) => {
            window.NativeBridgeCallback = (result) => {
              if (result.payload.success) {
                resolve(true);
              } else {
                reject(new Error(result.payload.error));
              }
              delete window.NativeBridgeCallback;
            };
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'initiatePaystackPayment',
              payload: { planId },
              callbackId: Date.now().toString()
            }));
          });
        },

        // Notifications
        async schedulePaymentNotifications(instances, title) {
          const results = [];
          for (const instance of instances) {
            results.push({
              instanceId: instance.id,
              notificationId: await new Promise((resolve) => {
                window.NativeBridgeCallback = (result) => {
                  resolve(result.payload.notificationId);
                  delete window.NativeBridgeCallback;
                };
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'scheduleNotification',
                  payload: {
                    dueDate: instance.dueDate,
                    amount: instance.amount,
                    description: title
                  },
                  callbackId: Date.now().toString()
                }));
              })
            });
          }
          return results;
        },

        async cancelNotification(instanceId) {
          // Implementation needed
        },

        async cancelAllNotifications() {
          // Implementation needed
        },

        async getNotifications() {
          return [];
        },

        async getUnreadCount() {
          return 0;
        },

        // Calendar
        async syncToCalendar(instances, title) {
          for (const instance of instances) {
            await new Promise((resolve) => {
              window.NativeBridgeCallback = (result) => {
                resolve(result.payload.success);
                delete window.NativeBridgeCallback;
              };
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'syncToCalendar',
                payload: {
                  dueDate: instance.dueDate,
                  amount: instance.amount,
                  title
                },
                callbackId: Date.now().toString()
              }));
            });
          }
          return true;
        },

        async removeFromCalendar(instanceIds) {
          // Implementation needed
        },

        // Scanning
        async scanReceipt() {
          return new Promise((resolve) => {
            window.NativeBridgeCallback = (result) => {
              resolve(result.payload);
              delete window.NativeBridgeCallback;
            };
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scanReceipt',
              callbackId: Date.now().toString()
            }));
          });
        },

        async scanProductImage() {
          // Implementation similar to scanReceipt
          return null;
        },

        // Ads

        // Utility
        defaultTransactionLimit: 20,
        log(message) {
          console.log('[YouFI]', message);
        }
      };

      // Listen for messages from native
      window.onNativeMessage = (message) => {
        console.log('[WebView] Received from native:', message.type);
        if (window.NativeBridgeCallback) {
          window.NativeBridgeCallback(message);
        }
      };

      true; // Required for injectedJavaScript
    `;
  };

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webviewRef}
        source={{
          uri: __DEV__ 
            ? 'http://localhost:5173' // Dev server
            : 'https://youfi.app'      // Production URL
        }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        injectedJavaScript={injectBridgeScript()}
        injectedJavaScriptBeforeContentLoaded={injectBridgeScript()}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        // Performance
        startInLoadingState={false}
        renderLoading={() => null}
        // Security
        originWhitelist={['*']}
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
});
