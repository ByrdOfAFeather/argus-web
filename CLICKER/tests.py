from django.test import TestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, InvalidArgumentException
import unittest
import enum
import time

TEST_FILES = "/home/byrdofafeather/Documents/argus_test_cases/moth4_med_fan_cam1.mp4\n/home/byrdofafeather/Documents/argus_test_cases/moth4_med_fan_cam2.mp4\n/home/byrdofafeather/Documents/argus_test_cases/moth4_med_fan_cam3.mp4"


class BrowserTypes(enum.Enum):
	Chrome = 0
	Firefox = 1


class GenericTest(unittest.TestCase):
	def wait_until_loaded(self, obj_id) -> bool:
		try:
			_ = WebDriverWait(self.driver, 25).until(
				EC.presence_of_element_located((By.ID, obj_id))
			)
			return True
		except TimeoutError:
			return False

	def navigate_to_new_project(self) -> bool:
		driver = self.driver
		driver.implicitly_wait(10)
		driver.get("http://127.0.0.1:8000/clicker")
		loaded = self.wait_until_loaded("new-project-button")
		if not loaded: return False
		driver.find_element_by_id("new-project-button").click()
		loaded = self.wait_until_loaded("project-name-input")
		if not loaded: return False
		try:
			driver.find_element_by_id("project-name-input").send_keys("TEST_PROJ")
		except NoSuchElementException:
			return False
		try:
			file_input = driver.find_element_by_id("video-file-input")
			file_input.send_keys(TEST_FILES)
		except NoSuchElementException:
			# Note that an Invalid Argument exception can be thrown here, but I have allowed that to happen as it
			# provides a more useful message than the default.
			return False
		driver.find_element_by_id("submit-button").click()
		loaded = self.wait_until_loaded("test-video-0")
		if not loaded: return False
		driver.find_element_by_id("offset-input").send_keys(0)
		driver.find_element_by_id("frame-rate-trigger").click()
		driver.find_element_by_id("frameRate-custom").click()
		driver.find_element_by_id("frame-rate-input").send_keys("5")
		driver.find_element_by_id("frame-rate-save-button").click()
		driver.find_element_by_id("save-init-settings-button").click()
		time.sleep(1)
		loaded = self.wait_until_loaded("test-video-1")
		if not loaded: return False
		driver.find_element_by_id("offset-input").send_keys(0)
		driver.find_element_by_id("save-init-settings-button").click()
		time.sleep(1)
		loaded = self.wait_until_loaded("test-video-2")
		if not loaded: return False
		driver.find_element_by_id("offset-input").send_keys(0)
		driver.find_element_by_id("save-init-settings-button").click()
		return True

	# def test_navigate_to_new_project(self):
	# 	did_nav = self.navigate_to_new_project()
	# 	self.assertTrue(did_nav, msg="Could not create a new project, perhaps an ID has been changed?"
	# 	                             "Check create_new_project!")

	def setUp(self) -> None:
		self.browser_type = BrowserTypes.Firefox
		if self.browser_type == BrowserTypes.Chrome:
			self.driver = webdriver.Chrome()
		elif self.browser_type == BrowserTypes.Firefox:
			self.driver = webdriver.Firefox()

	def tearDown(self) -> None:
		self.driver.close()


class TrackManagementAddFirefox(GenericTest, unittest.TestCase):
	def setUp(self) -> None:
		super(TrackManagementAddFirefox, self).setUp()

	def tearDown(self) -> None:
		super(TrackManagementAddFirefox, self).tearDown()

	def test_track_add(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()
		found_track = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.tracks.filter((track) => track.name == \"TEST_TRACK\").length")
		self.assertEqual(found_track, 1, msg="Could not find track with new name, test failed.")
		new_main = driver.execute_script("return getWindowManagerForTesting().trackManager.currentTrack.name")
		self.assertEqual(new_main, "TEST_TRACK", msg="Tracks did not switch on creating new track, test failed.")
		track_index = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.tracks.filter((track) => track.name == \"TEST_TRACK\")[0].absoluteIndex")
		self.assertEqual(track_index, 1, msg="Track index is not 1, test failed.")
		track_color = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.tracks.filter((track) => track.name == \"TEST_TRACK\")[0].color")
		self.assertNotEqual(track_color, None, msg="Color was undefined, test failed.")

	def test_track_add_same_name_twice(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("add-track-button").click()
		loaded = self.wait_until_loaded("error-message")
		self.assertTrue(loaded, msg="Error never loaded. Test Failed.")


class TrackManagementDeleteFirefox(GenericTest):
	def setUp(self) -> None:
		super(TrackManagementDeleteFirefox, self).setUp()

	def tearDown(self) -> None:
		super(TrackManagementDeleteFirefox, self).tearDown()

	def test_track_changes(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("trackdelete-1").click()
		current_track = driver.execute_script('return getWindowManagerForTesting().trackManager.currentTrack.name')
		self.assertEqual(current_track, "Track 0", msg="Track 0 was not moved back to the main track, test failed.")

	def test_subtracks(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()

		# Add Extra Tracks
		driver.find_element_by_id("new-track-input").send_keys("")
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK_2")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("new-track-input").send_keys("")

		# Set Subtracks
		driver.find_element_by_id("trackdisp-0-icon").click()
		driver.find_element_by_id("trackdisp-1-icon").click()
		no_sub = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.subTracks.trackIndicies.length")
		self.assertEqual(no_sub, 2, msg="Subtracks weren't added, test failed.")

		# Delete track
		driver.find_element_by_id("trackdelete-2").click()
		time.sleep(.5)
		no_sub = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.subTracks.trackIndicies.length")
		self.assertEqual(no_sub, 1, msg="Subtracks weren't maintained, test failed.")

	def test_clicked_points_deleted(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("trackdelete-1").click()
		no_tracks = driver.execute_script(
			"return Object.keys(getWindowManagerForTesting().clickedPointsManager.clickedPoints[0]).length")
		self.assertEqual(no_tracks, 1)

	def test_absolute_indicies(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("new-track-input").send_keys("")
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK_2")
		driver.find_element_by_id("add-track-button").click()
		driver.find_element_by_id("new-track-input").send_keys("")
		driver.find_element_by_id("new-track-input").send_keys("TEST_TRACK_3")
		driver.find_element_by_id("add-track-button").click()
		driver.execute_script(
			"getWindowManagerForTesting().clickedPointsManager.clickedPoints[0][getWindowManagerForTesting().trackManager.currentTrack.absoluteIndex] = [12]")
		driver.find_element_by_id("trackdelete-1").click()
		index_check = driver.execute_script(
			"return getWindowManagerForTesting().clickedPointsManager.clickedPoints[0][getWindowManagerForTesting().trackManager.currentTrack.absoluteIndex]")
		self.assertEqual(index_check[0], 12, msg="Absolute index does not index correctly, test failed.")

	def test_track_0(self):
		did_navigate = self.navigate_to_new_project()
		self.assertTrue(did_navigate, msg="Could not create project, test failed.")
		driver = self.driver
		driver.find_element_by_id("trackdelete-0-icon").click()
		track_0_info = driver.execute_script(
			"return getWindowManagerForTesting().trackManager.tracks.filter((track) => track.name == \"TRACK 0\")")
		self.assertNotEqual(track_0_info, None, msg="Track 0 was deleted, test failed.")


class TrackManagementTrackColorFirefox(GenericTest):
	def test_color_changes(self):
		pass


class TrackManagementChangingTracksFirefox(GenericTest):
	def test_track_changed(self):
		pass

	def test_subtracks(self):
		pass

	def test_points_redrawn(self):
		pass

	def test_subtracks_stash(self):
		pass


class LoadingDLTCoefficents(GenericTest):
	def test_load_dlt_parsing_positive(self):
		pass

	def test_load_dlt_parsing_negative(self):
		pass


class SavingProject(GenericTest):
	pass


class ExportPoints(GenericTest):
	pass


class ControlSettings(GenericTest):
	def test_auto_advance_positive_sync_positive(self):
		pass

	def test_auto_advance_positive_sync_negative(self):
		pass

	def test_auto_advance_negative_sync_positive(self):
		pass

	def test_auto_advance_negative_sync_negative(self):
		pass


class VideoSetting(GenericTest):
	def test_changing_video_settings(self):
		pass


class PopOut(GenericTest):
	pass


class Titlebar(GenericTest):
	def test_frame_change(self):
		pass

	def test_offset_change(self):
		pass


if __name__ == "__main__":
	unittest.main()
