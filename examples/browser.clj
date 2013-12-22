(ns browser)


(defn log-message
  [event]
  (log/debug event))

(defn typos-main
  [context?]
  (typos/init)
  (typos/add-handlers {:mouse-move log-event
                       :keypress log-event})
  (typos/add-catchall-handler log-event))

(defn -main
  []
  (typos/add-handler log-message)
  (typos/send "Hi"))
