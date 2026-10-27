import { AppRegistry } from "react-native";
import App from "./App";
import { name as appName } from "./app.json";

// Pure React Native entry (previously Expo's registerRootComponent).
AppRegistry.registerComponent(appName, () => App);
