import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginPage from './src/screens/LoginPage'
import DashboardPage from './src/screens/DashboardPage'
import RoutePage from './src/screens/RoutePage'
import SalesPage from './src/screens/SalesPage'

const Stack = createNativeStackNavigator()

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginPage}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardPage}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen
          name="Route"
          component={RoutePage}
          options={{ title: 'Route' }}
        />
        <Stack.Screen
          name="Sales"
          component={SalesPage}
          options={{ title: 'Sales' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App
