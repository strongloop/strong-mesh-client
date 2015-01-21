cd sample-app
cat pm.pid | xargs kill
slc pm --listen $PM_PORT & echo $$ > pm.pid
