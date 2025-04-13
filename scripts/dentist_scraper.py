#!/usr/bin/env python3
"""
Google Maps Scraper for Neurodivergent-Friendly Dentists

This script scrapes Google Maps for dentists, identifies those that mention
catering to neurodivergent individuals, and performs sentiment analysis on
these mentions. The data is formatted to match the Blausm app's data structure.
"""

import os
import json
import time
import random
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException

from bs4 import BeautifulSoup
from textblob import TextBlob

# Configuration
SEARCH_QUERY = "Dentists near New York, NY"
MAX_RESULTS = 50  # Maximum number of dentists to scrape
SCROLL_PAUSE_TIME = 1.5  # Time to pause between scrolls
REVIEW_SCROLL_PAUSE_TIME = 1  # Time to pause between review scrolls
MAX_REVIEWS_PER_DENTIST = 30  # Maximum number of reviews to scrape per dentist

# Keywords related to neurodivergence
NEURODIVERGENT_KEYWORDS = [
    "neurodivergent", "neurodiversity", "ND",
    "autism", "autistic", "Asperger's", "ADHD", 
    "attention deficit hyperactivity disorder",
    "sensory processing disorder", "SPD", "sensory sensitivities",
    "Tourette's", "special needs", "developmental disabilities",
    "anxiety", "fearful patients", "patient understanding",
    "calm dentist", "gentle dentist", "compassionate dentist",
    "pediatric autism", "children with special needs"
]

# Compile regex patterns for each keyword for more efficient searching
KEYWORD_PATTERNS = [re.compile(r'\b' + re.escape(keyword) + r'\b', re.IGNORECASE) for keyword in NEURODIVERGENT_KEYWORDS]

class GoogleMapsScraper:
    def __init__(self):
        self.driver = self._setup_driver()
        self.dentists = []
        self.current_id = 1  # Starting ID for dentists

    def _setup_driver(self) -> webdriver.Chrome:
        """Set up and return a Chrome WebDriver with appropriate options."""
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in headless mode
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        
        # Create a new Chrome driver
        driver = webdriver.Chrome(options=chrome_options)
        return driver

    def search_dentists(self, query: str) -> None:
        """Search for dentists on Google Maps."""
        print(f"Searching for: {query}")
        self.driver.get("https://www.google.com/maps")
        
        # Wait for the search box to be available and enter the query
        try:
            search_box = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "searchboxinput"))
            )
            search_box.clear()
            search_box.send_keys(query)
            search_box.send_keys(Keys.ENTER)
            
            # Wait for results to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed']"))
            )
            print("Search results loaded successfully")
        except TimeoutException:
            print("Timeout waiting for search results")
            return

    def scroll_results(self, max_results: int) -> None:
        """Scroll through the results to load more dentists."""
        print(f"Scrolling to load up to {max_results} results...")
        try:
            results_div = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed']"))
            )
            
            # Keep track of the number of results found
            last_count = 0
            
            # Scroll until we have enough results or no more new results are loading
            while True:
                # Get all result items
                items = results_div.find_elements(By.CSS_SELECTOR, "div[role='article']")
                current_count = len(items)
                
                # If we have enough results or no new results are loading, stop scrolling
                if current_count >= max_results or current_count == last_count:
                    break
                
                # Scroll to the bottom of the results
                self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", results_div)
                print(f"Scrolled to load more results. Current count: {current_count}")
                
                # Update the count and wait
                last_count = current_count
                time.sleep(SCROLL_PAUSE_TIME)
            
            print(f"Loaded {current_count} results")
        except TimeoutException:
            print("Timeout waiting for results div")
        except Exception as e:
            print(f"Error scrolling results: {e}")

    def extract_dentists(self, max_results: int) -> List[Dict]:
        """Extract information for each dentist from the search results."""
        print("Extracting dentist information...")
        dentists = []
        
        try:
            # Get all result items
            results_div = self.driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
            items = results_div.find_elements(By.CSS_SELECTOR, "div[role='article']")
            
            # Limit to max_results
            items = items[:max_results]
            
            for i, item in enumerate(items):
                try:
                    print(f"Processing dentist {i+1}/{len(items)}...")
                    
                    # Click on the item to view details
                    item.click()
                    time.sleep(2)  # Wait for details to load
                    
                    # Extract basic information
                    dentist = self._extract_dentist_details()
                    
                    if dentist:
                        # Extract and analyze reviews
                        reviews = self._extract_reviews()
                        dentist["reviews"] = reviews
                        
                        # Calculate average rating
                        if reviews:
                            avg_rating = sum(review["rating"] for review in reviews) / len(reviews)
                            dentist["averageRating"] = round(avg_rating, 1)
                        
                        # Check if this dentist mentions neurodivergence
                        has_neurodivergent_mentions = self._check_for_neurodivergent_mentions(dentist)
                        
                        # Only add dentists with neurodivergent mentions
                        if has_neurodivergent_mentions:
                            dentists.append(dentist)
                            print(f"Added dentist: {dentist['name']} (has neurodivergent mentions)")
                        else:
                            print(f"Skipped dentist: {dentist['name']} (no neurodivergent mentions)")
                    
                    # Go back to results
                    self.driver.execute_script("window.history.go(-1)")
                    time.sleep(1.5)  # Wait for results to reload
                    
                    # Re-get the results div and items as they may have become stale
                    results_div = self.driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
                    items = results_div.find_elements(By.CSS_SELECTOR, "div[role='article']")
                    items = items[:max_results]
                    
                except StaleElementReferenceException:
                    print("Element became stale, skipping to next dentist")
                    continue
                except Exception as e:
                    print(f"Error processing dentist: {e}")
                    continue
            
            print(f"Extracted {len(dentists)} dentists with neurodivergent mentions")
            return dentists
            
        except Exception as e:
            print(f"Error extracting dentists: {e}")
            return dentists

    def _extract_dentist_details(self) -> Dict:
        """Extract details for a single dentist."""
        try:
            # Wait for the details pane to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "h1"))
            )
            
            # Extract name
            name_element = self.driver.find_element(By.CSS_SELECTOR, "h1")
            name = name_element.text
            
            # Extract address
            address = ""
            try:
                address_button = self.driver.find_element(By.CSS_SELECTOR, "button[data-item-id='address']")
                address = address_button.find_element(By.CSS_SELECTOR, "div[class*='fontBodyMedium']").text
            except NoSuchElementException:
                print("Address not found")
            
            # Extract phone
            phone = ""
            try:
                phone_button = self.driver.find_element(By.CSS_SELECTOR, "button[data-item-id*='phone:tel:']")
                phone = phone_button.find_element(By.CSS_SELECTOR, "div[class*='fontBodyMedium']").text
            except NoSuchElementException:
                print("Phone not found")
            
            # Extract website
            website = None
            try:
                website_button = self.driver.find_element(By.CSS_SELECTOR, "a[data-item-id='authority']")
                website = website_button.get_attribute("href")
            except NoSuchElementException:
                print("Website not found")
            
            # Extract rating
            rating = 0
            try:
                rating_element = self.driver.find_element(By.CSS_SELECTOR, "div[role='img'][aria-label*='stars']")
                rating_text = rating_element.get_attribute("aria-label")
                rating = float(re.search(r"([\d.]+) stars", rating_text).group(1))
            except (NoSuchElementException, AttributeError):
                print("Rating not found")
            
            # Extract number of reviews
            num_reviews = 0
            try:
                reviews_text = self.driver.find_element(By.CSS_SELECTOR, "span[aria-label*='reviews']").text
                num_reviews = int(re.sub(r'[^\d]', '', reviews_text))
            except (NoSuchElementException, ValueError):
                print("Number of reviews not found")
            
            # Extract description (About section)
            description = ""
            short_description = ""
            try:
                # Try to find and click the About button
                about_buttons = self.driver.find_elements(By.XPATH, "//button[contains(., 'About')]")
                if about_buttons:
                    about_buttons[0].click()
                    time.sleep(1)
                    
                    # Extract the about text
                    about_sections = self.driver.find_elements(By.CSS_SELECTOR, "div[role='region']")
                    for section in about_sections:
                        description += section.text + " "
                    
                    # Go back to main info
                    self.driver.execute_script("window.history.go(-1)")
                    time.sleep(1)
            except Exception as e:
                print(f"Error extracting description: {e}")
            
            # Extract coordinates
            latitude = 40.7128  # Default to NYC coordinates
            longitude = -74.0060
            try:
                # Try to extract from URL
                url = self.driver.current_url
                coords_match = re.search(r'@([-\d.]+),([-\d.]+)', url)
                if coords_match:
                    latitude = float(coords_match.group(1))
                    longitude = float(coords_match.group(2))
            except Exception as e:
                print(f"Error extracting coordinates: {e}")
            
            # Extract hours
            hours = {}
            try:
                # Try to find and click the hours dropdown
                hours_buttons = self.driver.find_elements(By.XPATH, "//button[contains(., 'Hours')]")
                if hours_buttons:
                    hours_buttons[0].click()
                    time.sleep(1)
                    
                    # Extract the hours
                    days_elements = self.driver.find_elements(By.CSS_SELECTOR, "tr")
                    for day_element in days_elements:
                        day_parts = day_element.text.split(":")
                        if len(day_parts) >= 2:
                            day = day_parts[0].strip()
                            hour = day_parts[1].strip()
                            hours[day] = hour
                    
                    # If no hours found, set default hours
                    if not hours:
                        hours = {
                            'Monday': '9:00 AM - 5:00 PM',
                            'Tuesday': '9:00 AM - 5:00 PM',
                            'Wednesday': '9:00 AM - 5:00 PM',
                            'Thursday': '9:00 AM - 5:00 PM',
                            'Friday': '9:00 AM - 5:00 PM',
                            'Saturday': 'Closed',
                            'Sunday': 'Closed'
                        }
                    
                    # Go back to main info
                    self.driver.execute_script("window.history.go(-1)")
                    time.sleep(1)
            except Exception as e:
                print(f"Error extracting hours: {e}")
                # Set default hours
                hours = {
                    'Monday': '9:00 AM - 5:00 PM',
                    'Tuesday': '9:00 AM - 5:00 PM',
                    'Wednesday': '9:00 AM - 5:00 PM',
                    'Thursday': '9:00 AM - 5:00 PM',
                    'Friday': '9:00 AM - 5:00 PM',
                    'Saturday': 'Closed',
                    'Sunday': 'Closed'
                }
            
            # Create a short description from the full description
            if description:
                short_description = description[:100] + "..." if len(description) > 100 else description
            else:
                description = f"Dental practice located in {address}."
                short_description = description
            
            # Create dentist object
            dentist = {
                "id": str(self.current_id),
                "name": name,
                "description": description,
                "shortDescription": short_description,
                "category": "Dentist",
                "address": address,
                "latitude": latitude,
                "longitude": longitude,
                "phone": phone,
                "website": website,
                "hours": hours,
                "averageRating": rating,
                "reviews": []
            }
            
            self.current_id += 1
            return dentist
            
        except Exception as e:
            print(f"Error extracting dentist details: {e}")
            return None

    def _extract_reviews(self) -> List[Dict]:
        """Extract reviews for a dentist."""
        reviews = []
        
        try:
            # Click on Reviews tab
            review_tabs = self.driver.find_elements(By.XPATH, "//button[contains(., 'Reviews')]")
            if review_tabs:
                review_tabs[0].click()
                time.sleep(2)  # Wait for reviews to load
                
                # Scroll to load more reviews
                reviews_div = self.driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
                
                # Keep track of the number of reviews found
                last_count = 0
                scroll_attempts = 0
                max_scroll_attempts = 10
                
                # Scroll until we have enough reviews or no more new reviews are loading
                while scroll_attempts < max_scroll_attempts:
                    # Get all review items
                    review_items = reviews_div.find_elements(By.CSS_SELECTOR, "div[class*='fontBodyMedium']")
                    current_count = len(review_items)
                    
                    # If we have enough reviews or no new reviews are loading, stop scrolling
                    if current_count >= MAX_REVIEWS_PER_DENTIST or current_count == last_count:
                        scroll_attempts += 1
                    else:
                        scroll_attempts = 0
                    
                    # Scroll to the bottom of the reviews
                    self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", reviews_div)
                    
                    # Update the count and wait
                    last_count = current_count
                    time.sleep(REVIEW_SCROLL_PAUSE_TIME)
                
                # Extract review data
                review_items = reviews_div.find_elements(By.CSS_SELECTOR, "div[class*='fontBodyMedium']")
                
                for i, review_item in enumerate(review_items[:MAX_REVIEWS_PER_DENTIST]):
                    try:
                        # Extract review text
                        review_text = review_item.text
                        
                        # Skip if this doesn't look like a review
                        if not review_text or len(review_text) < 10:
                            continue
                        
                        # Extract rating
                        rating = 0
                        rating_element = review_item.find_element(By.XPATH, "./preceding-sibling::div[1]//span[contains(@aria-label, 'stars')]")
                        if rating_element:
                            rating_text = rating_element.get_attribute("aria-label")
                            rating_match = re.search(r"(\d+) stars?", rating_text)
                            if rating_match:
                                rating = int(rating_match.group(1))
                        
                        # Extract author
                        author = "Anonymous"
                        author_element = review_item.find_element(By.XPATH, "./preceding-sibling::div[2]//div[contains(@class, 'fontBodyMedium')]")
                        if author_element:
                            author = author_element.text
                        
                        # Extract date
                        date = datetime.now().strftime("%Y-%m-%d")
                        date_element = review_item.find_element(By.XPATH, "./preceding-sibling::div[1]//span[contains(@class, 'fontBodyMedium')]")
                        if date_element:
                            date_text = date_element.text
                            # Convert relative date to YYYY-MM-DD format
                            # This is a simplified version, in a real scraper you'd want more robust date parsing
                            if "a year ago" in date_text:
                                date = (datetime.now().replace(year=datetime.now().year-1)).strftime("%Y-%m-%d")
                            elif "years ago" in date_text:
                                years = int(re.search(r"(\d+) years ago", date_text).group(1))
                                date = (datetime.now().replace(year=datetime.now().year-years)).strftime("%Y-%m-%d")
                            elif "a month ago" in date_text:
                                date = (datetime.now().replace(month=datetime.now().month-1)).strftime("%Y-%m-%d")
                            elif "months ago" in date_text:
                                months = int(re.search(r"(\d+) months ago", date_text).group(1))
                                new_month = ((datetime.now().month - months - 1) % 12) + 1
                                new_year = datetime.now().year - ((datetime.now().month - months - 1) // 12)
                                date = datetime(new_year, new_month, 1).strftime("%Y-%m-%d")
                            elif "a week ago" in date_text:
                                date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
                            elif "weeks ago" in date_text:
                                weeks = int(re.search(r"(\d+) weeks ago", date_text).group(1))
                                date = (datetime.now() - timedelta(days=weeks*7)).strftime("%Y-%m-%d")
                            elif "a day ago" in date_text:
                                date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                            elif "days ago" in date_text:
                                days = int(re.search(r"(\d+) days ago", date_text).group(1))
                                date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
                        
                        # Create review object
                        review = {
                            "id": f"{self.current_id-1}-{i+1}",
                            "serviceId": str(self.current_id-1),
                            "rating": rating,
                            "comment": review_text,
                            "author": author,
                            "source": "Google Maps",
                            "date": date
                        }
                        
                        reviews.append(review)
                        
                    except Exception as e:
                        print(f"Error extracting review: {e}")
                        continue
                
                # Go back to main info
                self.driver.execute_script("window.history.go(-1)")
                time.sleep(1)
            
            return reviews
            
        except Exception as e:
            print(f"Error extracting reviews: {e}")
            return reviews

    def _check_for_neurodivergent_mentions(self, dentist: Dict) -> bool:
        """
        Check if the dentist mentions neurodivergence in description or reviews.
        Also adds sentiment analysis for any mentions found.
        """
        has_mentions = False
        
        # Check description
        description = dentist.get("description", "")
        if description:
            for pattern in KEYWORD_PATTERNS:
                if pattern.search(description):
                    has_mentions = True
                    keyword = pattern.search(description).group(0)
                    context = self._get_context(description, keyword)
                    sentiment = self._analyze_sentiment(context)
                    
                    # Add neurodivergent mention to description
                    if "neurodivergent_mentions" not in dentist:
                        dentist["neurodivergent_mentions"] = []
                    
                    dentist["neurodivergent_mentions"].append({
                        "keyword": keyword,
