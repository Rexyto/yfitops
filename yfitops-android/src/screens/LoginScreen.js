import React, { useState } from 'react';
import Icon from '../components/Icon';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function LoginScreen({ onLogin, serverUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('login.errorTitle'), t('login.errorEmpty'));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert(t('login.errorTitle'), data.error || t('login.errorCreds'));
        return;
      }
      onLogin(data.token, data.username);
    } catch (e) {
      Alert.alert(t('login.errorConnectionTitle'), t('login.errorConnection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />

      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          </View>
          <Text style={styles.appName}>YFitops</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Icon name="person-outline" size={18} color={colors.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('login.username')}
              placeholderTextColor={colors.textFaint}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={18} color={colors.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('login.password')}
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.loginBtnText}>{t('login.signIn')}</Text>
            }
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 52 },
  logoCircle: { width: 110, height: 110, borderRadius: 55, overflow: 'hidden', marginBottom: 20, borderWidth: 2, borderColor: '#1ed76066' },
  appName: { fontSize: 34, fontWeight: '800', color: c.text, letterSpacing: -1 },
  logoImage: { width: 110, height: 110 },
  form: { gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg2, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 16 },
  eyeBtn: { padding: 8 },
  loginBtn: { backgroundColor: '#1ed760', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

});
