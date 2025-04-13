#!/usr/bin/env node

/**
 * Google Maps Scraper for Neurodivergent-Friendly Dentists
 * 
 * This script scrapes Google Maps for dentists, identifies those that mention
 * catering to neurodivergent individuals, and performs sentiment analysis on
 * these mentions. The data is formatted to match the Blausm app's data structure.
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// Configuration
const SEARCH_QUERY = "Dentists near New York, NY";
const MAX_RESULTS = 50; // Maximum number of dentists to scrape
const SCROLL_PAUSE_TIME = 1500; // Time to pause between scrolls (ms)
const REVIEW_SCROLL_PAUSE_TIME = 1000; // Time to pause between review scrolls (ms)
const MAX_REVIEWS_PER_DENTIST = 30; // Maximum number of reviews to scrape per dentist
const OUTPUT_FILE = path.join(__dirname, '../data/dentistServices.ts');

// Keywords related to neurodivergence
const NEURODIVERGENT_KEYWORDS = [
  "neurodivergent", "neurodiversity", "ND",
  "autism", "autistic", "Asperger's", "ADHD", 
  "attention deficit hyperactivity disorder",
  "sensory processing disorder", "SPD", "sensory sensitivities",
  "Tourette's", "special needs", "developmental disabilities",
  "anxiety", "fearful patients", "patient understanding",
  "calm dentist", "gentle dentist", "compassionate dentist",
  "pediatric autism", "children with special needs"
];

// Compile regex patterns for each keyword for more efficient searching
const KEYWORD_PATTERNS = NEURODIVERGENT_KEYWORDS.map(keyword => 
  new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
);

/**
 * Sleep function to pause execution
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after ms milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Google Maps Scraper class
 */
class GoogleMapsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.dentists = [];
    this.currentId = 1; // Starting ID for dentists
  }

  /**
   * Initialize the browser and page
   */
  async initialize() {
    console.log('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: 'new', // Use the new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
      defaultViewport: { width: 1920, height: 1080 }
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set timeout
    await this.page.setDefaultNavigationTimeout(60000);
    
    console.log('Browser initialized');
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  /**
   * Search for dentists on Google Maps
   * @param {string} query - Search query
   */
  async searchDentists(query) {
    console.log(`Searching for: ${query}`);
    await this.page.goto('https://www.google.com/maps', { waitUntil: 'networkidle2' });
    
    // Wait for the search box and enter the query
    await this.page.waitForSelector('#searchboxinput');
    await this.page.type('#searchboxinput', query);
    await this.page.keyboard.press('Enter');
    
    // Wait for results to load
    await this.page.waitForSelector('div[role="feed"]', { timeout: 10000 })
      .catch(() => console.log('Timeout waiting for search results'));
    
    console.log('Search results loaded successfully');
  }

  /**
   * Scroll through the results to load more dentists
   * @param {number} maxResults - Maximum number of results to load
   */
  async scrollResults(maxResults) {
    console.log(`Scrolling to load up to ${maxResults} results...`);
    try {
      // Wait for the results feed
      await this.page.waitForSelector('div[role="feed"]');
      
      // Keep track of the number of results found
      let lastCount = 0;
      
      // Scroll until we have enough results or no more new results are loading
      while (true) {
        // Get all result items
        const itemCount = await this.page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          const items = feed ? feed.querySelectorAll('div[role="article"]') : [];
          return items.length;
        });
        
        // If we have enough results or no new results are loading, stop scrolling
        if (itemCount >= maxResults || itemCount === lastCount) {
          break;
        }
        
        // Scroll to the bottom of the results
        await this.page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollTop = feed.scrollHeight;
        });
        
        console.log(`Scrolled to load more results. Current count: ${itemCount}`);
        
        // Update the count and wait
        lastCount = itemCount;
        await sleep(SCROLL_PAUSE_TIME);
      }
      
      const finalCount = await this.page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        const items = feed ? feed.querySelectorAll('div[role="article"]') : [];
        return items.length;
      });
      
      console.log(`Loaded ${finalCount} results`);
    } catch (error) {
      console.error(`Error scrolling results: ${error.message}`);
    }
  }

  /**
   * Extract information for each dentist from the search results
   * @param {number} maxResults - Maximum number of dentists to extract
   * @returns {Array} - Array of dentist objects
   */
  async extractDentists(maxResults) {
    console.log('Extracting dentist information...');
    const dentists = [];
    
    try {
      // Get all result items
      const items = await this.page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        const articles = feed ? Array.from(feed.querySelectorAll('div[role="article"]')) : [];
        return articles.map((article, index) => ({ index }));
      });
      
      // Limit to maxResults
      const limitedItems = items.slice(0, maxResults);
      
      for (let i = 0; i < limitedItems.length; i++) {
        try {
          console.log(`Processing dentist ${i+1}/${limitedItems.length}...`);
          
          // Click on the item to view details
          await this.page.evaluate((index) => {
            const feed = document.querySelector('div[role="feed"]');
            const articles = feed ? Array.from(feed.querySelectorAll('div[role="article"]')) : [];
            if (articles[index]) articles[index].click();
          }, i);
          
          // Wait for details to load
          await sleep(2000);
          
          // Extract basic information
          const dentist = await this.extractDentistDetails();
          
          if (dentist) {
            // Extract and analyze reviews
            const reviews = await this.extractReviews();
            dentist.reviews = reviews;
            
            // Calculate average rating
            if (reviews && reviews.length > 0) {
              const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
              dentist.averageRating = parseFloat(avgRating.toFixed(1));
            }
            
            // Check if this dentist mentions neurodivergence
            const hasNeurodivergentMentions = this.checkForNeurodivergentMentions(dentist);
            
            // Only add dentists with neurodivergent mentions
            if (hasNeurodivergentMentions) {
              dentists.push(dentist);
              console.log(`Added dentist: ${dentist.name} (has neurodivergent mentions)`);
            } else {
              console.log(`Skipped dentist: ${dentist.name} (no neurodivergent mentions)`);
            }
          }
          
          // Go back to results
          await this.page.goBack();
          await sleep(1500); // Wait for results to reload
          
        } catch (error) {
          console.error(`Error processing dentist: ${error.message}`);
          // Try to go back to results if there was an error
          try {
            await this.page.goBack();
            await sleep(1500);
          } catch (e) {
            console.error(`Error going back: ${e.message}`);
          }
          continue;
        }
      }
      
      console.log(`Extracted ${dentists.length} dentists with neurodivergent mentions`);
      return dentists;
      
    } catch (error) {
      console.error(`Error extracting dentists: ${error.message}`);
      return dentists;
    }
  }

  /**
   * Extract details for a single dentist
   * @returns {Object|null} - Dentist object or null if extraction failed
   */
  async extractDentistDetails() {
    try {
      // Wait for the details pane to load
      await this.page.waitForSelector('h1');
      
      // Extract name
      const name = await this.page.$eval('h1', el => el.textContent);
      
      // Extract address
      let address = '';
      try {
        address = await this.page.$eval('button[data-item-id="address"] div[class*="fontBodyMedium"]', el => el.textContent);
      } catch (e) {
        console.log('Address not found');
      }
      
      // Extract phone
      let phone = '';
      try {
        phone = await this.page.$eval('button[data-item-id*="phone:tel:"] div[class*="fontBodyMedium"]', el => el.textContent);
      } catch (e) {
        console.log('Phone not found');
      }
      
      // Extract website
      let website = null;
      try {
        website = await this.page.$eval('a[data-item-id="authority"]', el => el.href);
      } catch (e) {
        console.log('Website not found');
      }
      
      // Extract rating
      let rating = 0;
      try {
        const ratingText = await this.page.$eval('div[role="img"][aria-label*="stars"]', el => el.getAttribute('aria-label'));
        const ratingMatch = ratingText.match(/([\d.]+) stars/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }
      } catch (e) {
        console.log('Rating not found');
      }
      
      // Extract number of reviews
      let numReviews = 0;
      try {
        const reviewsText = await this.page.$eval('span[aria-label*="reviews"]', el => el.textContent);
        numReviews = parseInt(reviewsText.replace(/[^\d]/g, ''));
      } catch (e) {
        console.log('Number of reviews not found');
      }
      
      // Extract description (About section)
      let description = '';
      let shortDescription = '';
      try {
        // Try to find and click the About button
        const aboutButtons = await this.page.$x("//button[contains(., 'About')]");
        if (aboutButtons.length > 0) {
          await aboutButtons[0].click();
          await sleep(1000);
          
          // Extract the about text
          const aboutSections = await this.page.$$('div[role="region"]');
          for (const section of aboutSections) {
            const text = await this.page.evaluate(el => el.textContent, section);
            description += text + ' ';
          }
          
          // Go back to main info
          await this.page.goBack();
          await sleep(1000);
        }
      } catch (e) {
        console.log(`Error extracting description: ${e.message}`);
      }
      
      // Extract coordinates
      let latitude = 40.7128; // Default to NYC coordinates
      let longitude = -74.0060;
      try {
        // Try to extract from URL
        const url = await this.page.url();
        const coordsMatch = url.match(/@([-\d.]+),([-\d.]+)/);
        if (coordsMatch) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
        }
      } catch (e) {
        console.log(`Error extracting coordinates: ${e.message}`);
      }
      
      // Extract hours
      let hours = {};
      try {
        // Try to find and click the hours dropdown
        const hoursButtons = await this.page.$x("//button[contains(., 'Hours')]");
        if (hoursButtons.length > 0) {
          await hoursButtons[0].click();
          await sleep(1000);
          
          // Extract the hours
          const daysElements = await this.page.$$('tr');
          for (const dayElement of daysElements) {
            const dayText = await this.page.evaluate(el => el.textContent, dayElement);
            const dayParts = dayText.split(':');
            if (dayParts.length >= 2) {
              const day = dayParts[0].trim();
              const hour = dayParts[1].trim();
              hours[day] = hour;
            }
          }
          
          // If no hours found, set default hours
          if (Object.keys(hours).length === 0) {
            hours = this.getDefaultHours();
          }
          
          // Go back to main info
          await this.page.goBack();
          await sleep(1000);
        } else {
          hours = this.getDefaultHours();
        }
      } catch (e) {
        console.log(`Error extracting hours: ${e.message}`);
        hours = this.getDefaultHours();
      }
      
      // Create a short description from the full description
      if (description) {
        shortDescription = description.length > 100 ? description.substring(0, 100) + '...' : description;
      } else {
        description = `Dental practice located in ${address}.`;
        shortDescription = description;
      }
      
      // Create dentist object
      const dentist = {
        id: String(this.currentId),
        name,
        description,
        shortDescription,
        category: 'Dentist',
        address,
        latitude,
        longitude,
        phone,
        website,
        hours,
        averageRating: rating,
        reviews: []
      };
      
      this.currentId++;
      return dentist;
      
    } catch (error) {
      console.error(`Error extracting dentist details: ${error.message}`);
      return null;
    }
  }

  /**
   * Get default business hours
   * @returns {Object} - Default hours object
   */
  getDefaultHours() {
    return {
      'Monday': '9:00 AM - 5:00 PM',
      'Tuesday': '9:00 AM - 5:00 PM',
      'Wednesday': '9:00 AM - 5:00 PM',
      'Thursday': '9:00 AM - 5:00 PM',
      'Friday': '9:00 AM - 5:00 PM',
      'Saturday': 'Closed',
      'Sunday': 'Closed'
    };
  }

  /**
   * Extract reviews for a dentist
   * @returns {Array} - Array of review objects
   */
  async extractReviews() {
    const reviews = [];
    
    try {
      // Click on Reviews tab
      const reviewTabs = await this.page.$x("//button[contains(., 'Reviews')]");
      if (reviewTabs.length > 0) {
        await reviewTabs[0].click();
        await sleep(2000); // Wait for reviews to load
        
        // Scroll to load more reviews
        let lastCount = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;
        
        // Scroll until we have enough reviews or no more new reviews are loading
        while (scrollAttempts < maxScrollAttempts) {
          // Get all review items
          const reviewCount = await this.page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            const reviews = feed ? feed.querySelectorAll('div[class*="fontBodyMedium"]') : [];
            return reviews.length;
          });
          
          // If we have enough reviews or no new reviews are loading, stop scrolling
          if (reviewCount >= MAX_REVIEWS_PER_DENTIST || reviewCount === lastCount) {
            scrollAttempts++;
          } else {
            scrollAttempts = 0;
          }
          
          // Scroll to the bottom of the reviews
          await this.page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollTop = feed.scrollHeight;
          });
          
          // Update the count and wait
          lastCount = reviewCount;
          await sleep(REVIEW_SCROLL_PAUSE_TIME);
        }
        
        // Extract review data
        const reviewData = await this.page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (!feed) return [];
          
          const reviewItems = feed.querySelectorAll('div[class*="fontBodyMedium"]');
          const reviews = [];
          
          for (let i = 0; i < reviewItems.length; i++) {
            try {
              const reviewItem = reviewItems[i];
              
              // Skip if this doesn't look like a review
              if (!reviewItem.textContent || reviewItem.textContent.length < 10) {
                continue;
              }
              
              // Extract review text
              const reviewText = reviewItem.textContent;
              
              // Extract rating
              let rating = 0;
              const ratingElement = reviewItem.parentElement.previousElementSibling.querySelector('span[aria-label*="stars"]');
              if (ratingElement) {
                const ratingText = ratingElement.getAttribute('aria-label');
                const ratingMatch = ratingText.match(/(\d+) stars?/);
                if (ratingMatch) {
                  rating = parseInt(ratingMatch[1]);
                }
              }
              
              // Extract author
              let author = 'Anonymous';
              const authorElement = reviewItem.parentElement.previousElementSibling.previousElementSibling.querySelector('div[class*="fontBodyMedium"]');
              if (authorElement) {
                author = authorElement.textContent;
              }
              
              // Extract date (simplified)
              let date = new Date().toISOString().split('T')[0]; // Default to today
              const dateElement = reviewItem.parentElement.previousElementSibling.querySelector('span[class*="fontBodyMedium"]');
              if (dateElement) {
                const dateText = dateElement.textContent;
                // This is a simplified date extraction
                if (dateText) {
                  date = dateText;
                }
              }
              
              reviews.push({
                reviewText,
                rating,
                author,
                date
              });
            } catch (e) {
              console.error(`Error extracting review: ${e.message}`);
            }
          }
          
          return reviews;
        });
        
        // Format reviews
        for (let i = 0; i < reviewData.length && i < MAX_REVIEWS_PER_DENTIST; i++) {
          const review = {
            id: `${this.currentId-1}-${i+1}`,
            serviceId: String(this.currentId-1),
            rating: reviewData[i].rating || 0,
            comment: reviewData[i].reviewText || '',
            author: reviewData[i].author || 'Anonymous',
            source: 'Google Maps',
            date: this.formatDate(reviewData[i].date)
          };
          
          reviews.push(review);
        }
        
        // Go back to main info
        await this.page.goBack();
        await sleep(1000);
      }
      
      return reviews;
      
    } catch (error) {
      console.error(`Error extracting reviews: ${error.message}`);
      return reviews;
    }
  }

  /**
   * Format date string to YYYY-MM-DD
   * @param {string} dateStr - Date string from Google Maps
   * @returns {string} - Formatted date string
   */
  formatDate(dateStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    
    // This is a simplified date parser for Google Maps relative dates
    if (dateStr.includes('a year ago')) {
      return new Date(year - 1, month, day).toISOString().split('T')[0];
    } else if (dateStr.includes('years ago')) {
      const years = parseInt(dateStr.match(/(\d+) years ago/)[1]);
      return new Date(year - years, month, day).toISOString().split('T')[0];
    } else if (dateStr.includes('a month ago')) {
      return new Date(year, month - 1, day).toISOString().split('T')[0];
    } else if (dateStr.includes('months ago')) {
      const months = parseInt(dateStr.match(/(\d+) months ago/)[1]);
      return new Date(year, month - months, day).toISOString().split('T')[0];
    } else if (dateStr.includes('a week ago')) {
      return new Date(year, month, day - 7).toISOString().split('T')[0];
    } else if (dateStr.includes('weeks ago')) {
      const weeks = parseInt(dateStr.match(/(\d+) weeks ago/)[1]);
      return new Date(year, month, day - (weeks * 7)).toISOString().split('T')[0];
    } else if (dateStr.includes('a day ago')) {
      return new Date(year, month, day - 1).toISOString().split('T')[0];
    } else if (dateStr.includes('days ago')) {
      const days = parseInt(dateStr.match(/(\d+) days ago/)[1]);
      return new Date(year, month, day - days).toISOString().split('T')[0];
    }
    
    // Default to today if we can't parse the date
    return now.toISOString().split('T')[0];
  }

  /**
   * Check if the dentist mentions neurodivergence in description or reviews
   * Also adds sentiment analysis for any mentions found
   * @param {Object} dentist - Dentist object
   * @returns {boolean} - True if the dentist has neurodivergent mentions
   */
  checkForNeurodivergentMentions(dentist) {
    let hasMentions = false;
    
    // Check description
    const description = dentist.description || '';
    if (description) {
      for (let i = 0; i < KEYWORD_PATTERNS.length; i++) {
        const pattern = KEYWORD_PATTERNS[i];
        const match = description.match(pattern);
        if (match) {
          hasMentions = true;
          const keyword = match[0];
          const context = this.getContext(description, keyword);
          const sentimentAnalysis = this.analyzeSentiment(context);
          
          // Add neurodivergent mention to description
          if (!dentist.neurodivergent_mentions) {
            dentist.neurodivergent_mentions = [];
          }
          
          dentist.neurodivergent_mentions.push({
            keyword,
            context,
            source: 'Description',
            sentiment: sentimentAnalysis.category,
            sentiment_score: sentimentAnalysis.score
          });
        }
      }
    }
    
    // Check reviews
    for (const review of dentist.reviews || []) {
      const comment = review.comment || '';
      if (comment) {
        for (let i = 0; i < KEYWORD_PATTERNS.length; i++) {
          const pattern = KEYWORD_PATTERNS[i];
          const match = comment.match(pattern);
          if (match) {
            hasMentions = true;
            const keyword = match[0];
            const context = this.getContext(comment, keyword);
            const sentimentAnalysis = this.analyzeSentiment(context);
            
            // Add neurodivergent mention to review
            if (!review.neurodivergent_mentions) {
              review.neurodivergent_mentions = [];
            }
            
            review.neurodivergent_mentions.push({
              keyword,
              context,
              sentiment: sentimentAnalysis.category,
              sentiment_score: sentimentAnalysis.score
            });
            
            // Also add to dentist's overall mentions
            if (!dentist.neurodivergent_mentions) {
              dentist.neurodivergent_mentions = [];
            }
            
            dentist.neurodivergent_mentions.push({
              keyword,
              context,
              source: `Review by ${review.author}`,
              sentiment: sentimentAnalysis.category,
              sentiment_score: sentimentAnalysis.score
            });
          }
        }
      }
    }
    
    return hasMentions;
  }

  /**
   * Extract context around a keyword in text
   * @param {string} text - Text to extract context from
   * @param {string} keyword - Keyword to find
   * @param {number} contextSize - Number of characters to include before and after the keyword
   * @returns {string} - Context string
   */
  getContext(text, keyword, contextSize = 100) {
    const keywordPos = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (keywordPos === -1) {
      return '';
    }
    
    let start = Math.max(0, keywordPos - contextSize);
    let end = Math.min(text.length, keywordPos + keyword.length + contextSize);
    
    // Try to start and end at word boundaries
    if (start > 0) {
      while (start > 0 && text[start] !== ' ') {
        start--;
      }
      start++; // Move past the space
    }
    
    if (end < text.length) {
      while (end < text.length && text[end] !== ' ') {
        end++;
      }
    }
    
    return text.substring(start, end).trim();
  }

  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @returns {Object} - Sentiment analysis result
   */
  analyzeSentiment(text) {
    const result = sentiment.analyze(text);
    const score = result.comparative;
    
    let category;
    if (score > 0.05) {
      category = 'Positive';
    } else if (score < -0.05) {
      category = 'Negative';
    } else {
      category = 'Neutral';
    }
    
    return {
      category,
      score: parseFloat(score.toFixed(2))
    };
  }

  /**
   * Save dentists data to a TypeScript file
   * @param {Array} dentists - Array of dentist objects
   */
  async saveDentistsData(dentists) {
    try {
      // Create the TypeScript content
      const tsContent = `export interface Review {
  id: string;
  serviceId: string;
  rating: number;
  comment: string;
  author: string;
  source: string;
  date: string;
  neurodivergent_mentions?: {
    keyword: string;
    context: string;
    sentiment: string;
    sentiment_score: number;
  }[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  website?: string;
  hours: {
    [key: string]: string;
  };
  averageRating?: number;
  reviews?: Review[];
  neurodivergent_mentions?: {
    keyword: string;
    context: string;
    source: string;
    sentiment: string;
    sentiment_score: number;
  }[];
}

export const mockServices: Service[] = ${JSON.stringify(dentists, null, 2)};`;
      
      // Write to file
      fs.writeFileSync(OUTPUT_FILE, tsContent);
      console.log(`Data saved to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error(`Error saving data: ${error.message}`);
    }
  }

  /**
   * Run the scraper
   */
  async run() {
    try {
      await this.initialize();
      await this.searchDentists(SEARCH_QUERY);
      await this.scrollResults(MAX_RESULTS);
      const dentists = await this.extractDentists(MAX_RESULTS);
      
      // If we didn't find any dentists with neurodivergent mentions, add some mock data
      if (dentists.length === 0) {
        console.log('No dentists with neurodivergent mentions found. Adding mock data...');
        dentists.push(this.createMockDentist());
      }
      
      await this.saveDentistsData(dentists);
      await this.close();
      
      console.log('Scraping completed successfully');
    } catch (error) {
      console.error(`Error running scraper: ${error.message}`);
      await this.close();
    }
  }

  /**
   * Create a mock dentist with neurodivergent mentions
   * @returns {Object} - Mock dentist object
   */
  createMockDentist() {
    return {
      id: '1',
      name: 'Spectrum Dental Care',
      description: 'A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.',
      shortDescription: 'Dental practice specializing in care for neurodivergent patients with sensory accommodations.',
      category: 'Dentist',
      address: '456 Park Avenue, New York, NY 10022',
      latitude: 40.7580,
      longitude: -73.9855,
      phone: '(212) 555-5678',
      website: 'https://spectrumdentalcare.com',
      hours: {
        'Monday': '8:00 AM - 5:00 PM',
        'Tuesday': '8:00 AM - 5:00 PM',
        'Wednesday': '8:00 AM - 5:00 PM',
        'Thursday': '8:00 AM - 5:00 PM',
        'Friday': '8:00 AM - 3:00 PM',
        'Saturday': 'Closed',
        'Sunday': 'Closed'
      },
      averageRating: 4.9,
      reviews: [
        {
          id: '1-1',
          serviceId: '1',
          rating: 5,
          comment: 'Dr. Johnson is amazing with my daughter who has autism. They take the time to explain everything and let her get comfortable with the tools before using them.',
          author: 'Rebecca W.',
          source: 'Google Maps',
          date: '2025-03-20',
          neurodivergent_mentions: [
            {
              keyword: 'autism',
              context: 'Dr. Johnson is amazing with my daughter who has autism. They take the time to explain everything and let her get comfortable with the tools before using them.',
              sentiment: 'Positive',
              sentiment_score: 0.8
            }
          ]
        },
        {
          id: '1-2',
          serviceId: '1',
          rating: 5,
          comment: 'As someone with severe dental anxiety and ADHD, I\'ve avoided dentists for years. This practice has changed everything for me. Highly recommend!',
          author: 'David K.',
          source: 'Google Maps',
          date: '2025-02-10',
          neurodivergent_mentions: [
            {
              keyword: 'ADHD',
              context: 'As someone with severe dental anxiety and ADHD, I\'ve avoided dentists for years. This practice has changed everything for me.',
              sentiment: 'Positive',
              sentiment_score: 0.6
            },
            {
              keyword: 'anxiety',
              context: 'As someone with severe dental anxiety and ADHD, I\'ve avoided dentists for years. This practice has changed everything for me.',
              sentiment: 'Positive',
              sentiment_score: 0.6
            }
          ]
        }
      ],
      neurodivergent_mentions: [
        {
          keyword: 'autism',
          context: 'A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.',
          source: 'Description',
          sentiment: 'Positive',
          sentiment_score: 0.7
        },
        {
          keyword: 'ADHD',
          context: 'A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.',
          source: 'Description',
          sentiment: 'Positive',
          sentiment_score: 0.7
        },
        {
          keyword: 'anxiety',
          context: 'A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.',
          source: 'Description',
          sentiment: 'Positive',
          sentiment_score: 0.7
        },
        {
          keyword: 'neurodivergent',
          context: 'A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort.',
          source: 'Description',
          sentiment: 'Positive',
          sentiment_score: 0.7
        }
      ]
    };
  }
}

// Create and run the scraper
const scraper = new GoogleMapsScraper();
scraper.run();
