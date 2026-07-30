import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'

interface Waypoint {
  id: number
  name: string
  address: string
  status: 'pending' | 'visited'
}

export default function RoutePage({ navigation }: any) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: 1, name: 'Coffee Shop A', address: '123 Main St', status: 'pending' },
    { id: 2, name: 'Restaurant B', address: '456 Oak Ave', status: 'pending' },
    { id: 3, name: 'Office C', address: '789 Pine Rd', status: 'pending' },
  ])

  const handleCheckin = (id: number) => {
    setWaypoints(waypoints.map(wp =>
      wp.id === id ? { ...wp, status: 'visited' } : wp
    ))
    Alert.alert('Success', 'Checked in successfully!')
  }

  const completedCount = waypoints.filter(wp => wp.status === 'visited').length

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Progress: {completedCount}/{waypoints.length} stops
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completedCount / waypoints.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {waypoints.map((waypoint) => (
        <View key={waypoint.id} style={styles.waypointCard}>
          <View style={styles.waypointInfo}>
            <Text style={styles.waypointName}>{waypoint.name}</Text>
            <Text style={styles.waypointAddress}>{waypoint.address}</Text>
            <Text
              style={[
                styles.waypointStatus,
                { color: waypoint.status === 'visited' ? '#059669' : '#d97706' },
              ]}
            >
              {waypoint.status === 'visited' ? '✓ Visited' : 'Pending'}
            </Text>
          </View>
          {waypoint.status === 'pending' && (
            <TouchableOpacity
              style={styles.checkinButton}
              onPress={() => handleCheckin(waypoint.id)}
            >
              <Text style={styles.checkinText}>Check In</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
  },
  waypointCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  waypointAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  waypointStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkinButton: {
    backgroundColor: '#d97706',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  checkinText: {
    color: 'white',
    fontWeight: '600',
  },
  backButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#6b7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})
