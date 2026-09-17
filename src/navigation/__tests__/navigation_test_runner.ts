/**
 * Automated Verification Test Suite for Voice Navigation
 */

import { parseNavigationIntent } from '../destinationParser';
import { generateGoogleMapsUrl, generateAndroidIntentUrl } from '../googleMapsLauncher';
import { NavigationService } from '../navigationService';

interface TestCase {
  input: string;
  expectedIntent: string;
  expectedDestination?: string | null;
  expectedTravelMode?: string;
  expectedSpokenSubstrings?: string[];
  isAmbiguous?: boolean;
}

const testCases: TestCase[] = [
  // 1. "Take me to Chennai Central."
  {
    input: "Take me to Chennai Central.",
    expectedIntent: "NAVIGATION",
    expectedDestination: "Chennai Central",
    expectedTravelMode: "walking",
    expectedSpokenSubstrings: ["Chennai Central"],
    isAmbiguous: false,
  },
  // 2. "Navigate to Marina Beach."
  {
    input: "Navigate to Marina Beach.",
    expectedIntent: "NAVIGATION",
    expectedDestination: "Marina Beach",
    expectedTravelMode: "walking",
    expectedSpokenSubstrings: ["Marina Beach"],
    isAmbiguous: false,
  },
  // 3. "Take me to Chennai Airport by car."
  {
    input: "Take me to Chennai Airport by car.",
    expectedIntent: "NAVIGATION",
    expectedDestination: "Chennai Airport",
    expectedTravelMode: "driving",
    expectedSpokenSubstrings: ["Chennai Airport", "driving"],
    isAmbiguous: false,
  },
  // 4. "Walk me to the railway station."
  {
    input: "Walk me to the railway station.",
    expectedIntent: "NAVIGATION",
    expectedDestination: "railway station",
    expectedTravelMode: "walking",
    expectedSpokenSubstrings: ["railway station", "walking"],
    isAmbiguous: false,
  },
  // 5. "Cancel navigation."
  {
    input: "Cancel navigation.",
    expectedIntent: "CANCEL_NAVIGATION",
    expectedDestination: null,
    expectedSpokenSubstrings: ["Navigation cancelled."],
    isAmbiguous: false,
  },
  // 6. "Change destination to Marina Beach."
  {
    input: "Change destination to Marina Beach.",
    expectedIntent: "CHANGE_DESTINATION",
    expectedDestination: "Marina Beach",
    expectedTravelMode: "walking",
    expectedSpokenSubstrings: ["Marina Beach"],
    isAmbiguous: false,
  },
  // 7. "Take me to Agni College of Technology."
  {
    input: "Take me to Agni College of Technology.",
    expectedIntent: "NAVIGATION",
    expectedDestination: "Agni College of Technology",
    expectedTravelMode: "walking",
    expectedSpokenSubstrings: ["Agni College of Technology"],
    isAmbiguous: false,
  },
  // Extra 1: "How do I get to Chennai Airport?"
  {
    input: "How do I get to Chennai Airport?",
    expectedIntent: "NAVIGATION",
    expectedDestination: "Chennai Airport",
    expectedTravelMode: "walking",
    isAmbiguous: false,
  },
  // Extra 2: "Take me to the nearest hospital"
  {
    input: "Take me to the nearest hospital",
    expectedIntent: "NAVIGATION",
    expectedDestination: "the nearest hospital",
    expectedTravelMode: "walking",
    isAmbiguous: false,
  },
  // Extra 3: "Take me to the railway station by walking"
  {
    input: "Take me to the railway station by walking",
    expectedIntent: "NAVIGATION",
    expectedDestination: "railway station",
    expectedTravelMode: "walking",
    isAmbiguous: false,
  },
  // Extra 4: Ambiguity test: "Take me somewhere else"
  {
    input: "Take me somewhere else",
    expectedIntent: "CHANGE_DESTINATION",
    isAmbiguous: true,
    expectedSpokenSubstrings: ["Which location do you mean?"],
  },
  // Extra 5: "Where am I?"
  {
    input: "Where am I?",
    expectedIntent: "WHERE_AM_I",
    isAmbiguous: false,
  },
  // Extra 6: "How far is my destination?"
  {
    input: "How far is my destination?",
    expectedIntent: "HOW_FAR",
    isAmbiguous: false,
  },
];

async function runTests() {
  console.log("=================================================================");
  console.log("VISIONASSIST AI GLASSES - VOICE NAVIGATION AUTOMATED TEST SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  const navService = new NavigationService();

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const testNum = i + 1;
    console.log(`[TEST ${testNum}] Input: "${tc.input}"`);

    const parsed = parseNavigationIntent(tc.input, "walking");
    let testPassed = true;
    const errors: string[] = [];

    // Verify Intent
    if (parsed.intent !== tc.expectedIntent) {
      errors.push(`Expected intent '${tc.expectedIntent}', got '${parsed.intent}'`);
      testPassed = false;
    }

    // Verify Destination
    if (tc.expectedDestination !== undefined && parsed.destination !== tc.expectedDestination) {
      errors.push(`Expected destination '${tc.expectedDestination}', got '${parsed.destination}'`);
      testPassed = false;
    }

    // Verify Travel Mode
    if (tc.expectedTravelMode !== undefined && parsed.travel_mode !== tc.expectedTravelMode) {
      errors.push(`Expected travel_mode '${tc.expectedTravelMode}', got '${parsed.travel_mode}'`);
      testPassed = false;
    }

    // Verify Ambiguity
    if (tc.isAmbiguous !== undefined && parsed.isAmbiguous !== tc.isAmbiguous) {
      errors.push(`Expected isAmbiguous=${tc.isAmbiguous}, got ${parsed.isAmbiguous}`);
      testPassed = false;
    }

    // Verify URL generation if destination is present
    if (parsed.destination) {
      const url = generateGoogleMapsUrl(parsed.destination, parsed.travel_mode);
      const expectedUrlPrefix = "https://www.google.com/maps/dir/?api=1&destination=";
      if (!url.startsWith(expectedUrlPrefix)) {
        errors.push(`Generated URL does not start with standard prefix: ${url}`);
        testPassed = false;
      }
      if (!url.includes(`travelmode=${parsed.travel_mode}`)) {
        errors.push(`Generated URL does not include travelmode=${parsed.travel_mode}: ${url}`);
        testPassed = false;
      }
      console.log(`  -> URL: ${url}`);

      const androidUri = generateAndroidIntentUrl(parsed.destination, parsed.travel_mode);
      console.log(`  -> Android URI: ${androidUri}`);
    }

    // Test NavigationService execution
    const serviceRes = await navService.handleVoiceQuery(tc.input, { autoLaunch: false });
    console.log(`  -> Spoken Response: "${serviceRes.spoken_response}"`);

    if (tc.expectedSpokenSubstrings) {
      for (const substr of tc.expectedSpokenSubstrings) {
        if (!serviceRes.spoken_response.includes(substr)) {
          errors.push(`Spoken response does not contain '${substr}': "${serviceRes.spoken_response}"`);
          testPassed = false;
        }
      }
    }

    if (testPassed) {
      console.log(`  ✅ PASSED\n`);
      passed++;
    } else {
      console.error(`  ❌ FAILED:`);
      errors.forEach((e) => console.error(`     - ${e}`));
      console.log("");
      failed++;
    }
  }

  console.log("-----------------------------------------------------------------");
  console.log(`Summary: ${passed} Passed, ${failed} Failed out of ${testCases.length} Tests`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
