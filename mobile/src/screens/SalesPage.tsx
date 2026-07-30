import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'

export default function SalesPage({ navigation }: any) {
  const [formData, setFormData] = useState({
    variant: '',
    quantity: '',
    customerName: '',
    notes: '',
  })

  const handleSubmit = () => {
    if (!formData.variant || !formData.quantity) {
      Alert.alert('Error', 'Please fill in variant and quantity')
      return
    }
    Alert.alert('Success', 'Sale registered successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ])
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Coffee Variant *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Espresso Blend"
          value={formData.variant}
          onChangeText={(text) => setFormData({ ...formData, variant: text })}
        />

        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          style={styles.input}
          placeholder="Number of units"
          value={formData.quantity}
          onChangeText={(text) => setFormData({ ...formData, quantity: text })}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Customer Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer name"
          value={formData.customerName}
          onChangeText={(text) => setFormData({ ...formData, customerName: text })}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional notes"
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Register Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
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
  form: {
    padding: 16,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#d97706',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 16,
  },
})
