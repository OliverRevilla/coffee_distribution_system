import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'

export default function DashboardPage({ navigation }: any) {
  const [stats, setStats] = useState({
    todayRoutes: 0,
    totalSales: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    // In a real app, fetch data from API
    setStats({
      todayRoutes: 3,
      totalSales: 12,
      totalRevenue: 456.78,
    })
  }, [])

  return (
    <ScrollView style={styles.container}>
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statLabel}>Today's Routes</Text>
          <Text style={[styles.statValue, { color: '#d97706' }]}>{stats.todayRoutes}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.totalSales}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={[styles.statValue, { color: '#2563eb' }]}>
            ${stats.totalRevenue.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Route')}
        >
          <Text style={styles.actionText}>View Routes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Sales')}
        >
          <Text style={styles.actionText}>Register Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.actionText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#d97706',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})
