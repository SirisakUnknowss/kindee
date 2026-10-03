import NetInfo from '@react-native-community/netinfo'

let online = true

NetInfo.addEventListener((state) => {
  online = state.isConnected !== false && state.isInternetReachable !== false
})

export const isOnline = () => online

export function subscribeOnline(fn: (online: boolean) => void) {
  return NetInfo.addEventListener((state) => fn(state.isConnected !== false && state.isInternetReachable !== false))
}
