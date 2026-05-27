import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { fonts } from '../../theme/typography'

const GRADIENT_START = '#7657F0'
const GRADIENT_END   = '#8874E1'
const LAVENDER       = '#EAE4FB'
const PURPLE         = '#7657F0'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>
}

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <LinearGradient colors={[GRADIENT_START, GRADIENT_END]} style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/Tshelo icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>

        {/* Bottom content */}
        <View style={styles.bottom}>
          <Text style={styles.heading}>Community Savings{'\n'}Made Simple</Text>
          <Text style={styles.body}>
            Track contributions for funerals, weddings, graduations and more,
            transparently and securely
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginText}>LOGIN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerText}>Create an Account</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },

  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 29,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },

  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 34,
    fontFamily: fonts.display.bold,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 14,
  },
  body: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 26,
    marginBottom: 51,
  },

  loginButton: {
    backgroundColor: '#7439E0',
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  registerButton: {
    backgroundColor: LAVENDER,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 50,
  },
  registerText: {
    color: PURPLE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
