#!/usr/bin/env node

/**
 * This script runs the dentist scraper and then updates the app to use the scraped data.
 * It copies the scraped data from dentistServices.ts to mockServices.ts.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DENTIST_SERVICES_PATH = path.join(__dirname, '../data/dentistServices.ts');
const MOCK_SERVICES_PATH = path.join(__dirname, '../data/mockServices.ts');

// Run the dentist scraper
console.log('Running dentist scraper...');
exec('npm run scrape-dentists', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running dentist scraper: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Dentist scraper stderr: ${stderr}`);
  }
  
  console.log(`Dentist scraper stdout: ${stdout}`);
  
  // Check if dentistServices.ts exists
  if (!fs.existsSync(DENTIST_SERVICES_PATH)) {
    console.error(`Error: ${DENTIST_SERVICES_PATH} does not exist`);
    console.log('Creating mock dentist data...');
    createMockDentistData();
    return;
  }
  
  // Read the dentistServices.ts file
  console.log('Reading dentistServices.ts...');
  const dentistServicesContent = fs.readFileSync(DENTIST_SERVICES_PATH, 'utf8');
  
  // Check if the file has any dentists
  const dentistServicesMatch = dentistServicesContent.match(/export const mockServices: Service\[\] = ([\s\S]*);/);
  if (!dentistServicesMatch || dentistServicesMatch[1].trim() === '[]') {
    console.log('No dentists found in dentistServices.ts. Creating mock dentist data...');
    createMockDentistData();
    return;
  }
  
  // Check if mockServices.ts exists
  if (!fs.existsSync(MOCK_SERVICES_PATH)) {
    console.error(`Error: ${MOCK_SERVICES_PATH} does not exist`);
    return;
  }
  
  // Read the mockServices.ts file to get the interface definitions
  console.log('Reading mockServices.ts...');
  const mockServicesContent = fs.readFileSync(MOCK_SERVICES_PATH, 'utf8');
  
  // Extract the interface definitions from mockServices.ts
  const interfaceMatch = mockServicesContent.match(/export interface Review[\s\S]*?export interface Service[\s\S]*?};/);
  if (!interfaceMatch) {
    console.error('Error: Could not extract interface definitions from mockServices.ts');
    return;
  }
  
  const interfaceDefinitions = interfaceMatch[0];
  
  // Extract the mockServices array from dentistServices.ts
  const mockServicesMatch = dentistServicesContent.match(/export const mockServices: Service\[\] = ([\s\S]*);/);
  if (!mockServicesMatch) {
    console.error('Error: Could not extract mockServices array from dentistServices.ts');
    return;
  }
  
  const mockServicesArray = mockServicesMatch[1];
  
  // Create the new mockServices.ts content
  const newMockServicesContent = `${interfaceDefinitions}

export const mockServices: Service[] = ${mockServicesArray};`;
  
  // Write the new mockServices.ts file
  console.log('Writing new mockServices.ts...');
  fs.writeFileSync(MOCK_SERVICES_PATH, newMockServicesContent);
  
  console.log('Done! The app now uses the scraped dentist data.');
});

/**
 * Create mock dentist data if the scraper fails
 */
function createMockDentistData() {
  console.log('Creating mock dentist data...');
  
  // Read the mockServices.ts file to get the interface definitions
  if (!fs.existsSync(MOCK_SERVICES_PATH)) {
    console.error(`Error: ${MOCK_SERVICES_PATH} does not exist`);
    return;
  }
  
  const mockServicesContent = fs.readFileSync(MOCK_SERVICES_PATH, 'utf8');
  
  // Extract the interface definitions from mockServices.ts
  const interfaceMatch = mockServicesContent.match(/export interface Review[\s\S]*?export interface Service[\s\S]*?};/);
  if (!interfaceMatch) {
    console.error('Error: Could not extract interface definitions from mockServices.ts');
    return;
  }
  
  const interfaceDefinitions = interfaceMatch[0];
  
  // Create mock dentist data
  const mockDentists = [
    createMockDentist('1', 'Spectrum Dental Care', 'Manhattan'),
    createMockDentist('2', 'Gentle Dental Care', 'Brooklyn'),
    createMockDentist('3', 'Calm Kids Dentistry', 'Queens')
  ];
  
  // Create the dentistServices.ts content
  const dentistServicesContent = `${interfaceDefinitions}

export const mockServices: Service[] = ${JSON.stringify(mockDentists, null, 2)};`;
  
  // Write to dentistServices.ts
  fs.writeFileSync(DENTIST_SERVICES_PATH, dentistServicesContent);
  console.log(`Mock data saved to ${DENTIST_SERVICES_PATH}`);
  
  // Also update mockServices.ts
  fs.writeFileSync(MOCK_SERVICES_PATH, dentistServicesContent);
  console.log(`Mock data saved to ${MOCK_SERVICES_PATH}`);
  
  console.log('Done! The app now uses the mock dentist data.');
}

/**
 * Create a mock dentist with neurodivergent mentions
 * @param {string} id - ID for the dentist
 * @param {string} name - Name of the dentist
 * @param {string} location - Location (borough) of the dentist
 * @returns {Object} - Mock dentist object
 */
function createMockDentist(id, name, location) {
  return {
    id,
    name,
    description: `${name} is a dental practice that specializes in providing a comfortable environment for patients with special needs, including those with autism, ADHD, and anxiety. Our staff is trained to work with neurodivergent patients of all ages.`,
    shortDescription: `Dental practice specializing in care for patients with special needs in ${location}.`,
    category: 'Dentist',
    address: `${100 + parseInt(id) * 100} Main Street, ${location}, NY`,
    latitude: 40.7128 + (parseInt(id) * 0.01),
    longitude: -74.0060 + (parseInt(id) * 0.01),
    phone: `(212) 555-${1000 + parseInt(id) * 1000}`,
    website: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    hours: {
      'Monday': '9:00 AM - 5:00 PM',
      'Tuesday': '9:00 AM - 5:00 PM',
      'Wednesday': '9:00 AM - 5:00 PM',
      'Thursday': '9:00 AM - 5:00 PM',
      'Friday': '9:00 AM - 3:00 PM',
      'Saturday': 'Closed',
      'Sunday': 'Closed'
    },
    averageRating: 4.7,
    reviews: [
      {
        id: `${id}-1`,
        serviceId: id,
        rating: 5,
        comment: `My child has autism and ${name} was incredibly patient and understanding. They took the time to explain everything and made the visit stress-free.`,
        author: 'Parent Review',
        source: 'Google Maps',
        date: '2025-02-15',
        neurodivergent_mentions: [
          {
            keyword: 'autism',
            context: `My child has autism and ${name} was incredibly patient and understanding.`,
            sentiment: 'Positive',
            sentiment_score: 0.8
          }
        ]
      },
      {
        id: `${id}-2`,
        serviceId: id,
        rating: 4,
        comment: 'Great for patients with anxiety. The staff is very accommodating and the environment is calming.',
        author: 'Patient Review',
        source: 'Google Maps',
        date: '2025-01-20',
        neurodivergent_mentions: [
          {
            keyword: 'anxiety',
            context: 'Great for patients with anxiety. The staff is very accommodating and the environment is calming.',
            sentiment: 'Positive',
            sentiment_score: 0.7
          }
        ]
      }
    ],
    neurodivergent_mentions: [
      {
        keyword: 'autism',
        context: `${name} is a dental practice that specializes in providing a comfortable environment for patients with special needs, including those with autism, ADHD, and anxiety.`,
        source: 'Description',
        sentiment: 'Positive',
        sentiment_score: 0.6
      },
      {
        keyword: 'ADHD',
        context: `${name} is a dental practice that specializes in providing a comfortable environment for patients with special needs, including those with autism, ADHD, and anxiety.`,
        source: 'Description',
        sentiment: 'Positive',
        sentiment_score: 0.6
      },
      {
        keyword: 'anxiety',
        context: `${name} is a dental practice that specializes in providing a comfortable environment for patients with special needs, including those with autism, ADHD, and anxiety.`,
        source: 'Description',
        sentiment: 'Positive',
        sentiment_score: 0.6
      },
      {
        keyword: 'special needs',
        context: `${name} is a dental practice that specializes in providing a comfortable environment for patients with special needs, including those with autism, ADHD, and anxiety.`,
        source: 'Description',
        sentiment: 'Positive',
        sentiment_score: 0.6
      },
      {
        keyword: 'neurodivergent',
        context: `Our staff is trained to work with neurodivergent patients of all ages.`,
        source: 'Description',
        sentiment: 'Positive',
        sentiment_score: 0.7
      }
    ]
  };
}
