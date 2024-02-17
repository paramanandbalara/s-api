function print(path, layer) {
    if (layer.route) {
        layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
    } else if (layer.name === 'router' && layer.handle.stack) {
        layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
    } else if (layer.method) {
        let routes = path.concat(split(layer.regexp)).filter(Boolean).join('/').split(',')
        routes.forEach((route) => {
            if (route.startsWith('/'))
                setRoutes.add(route);
            else
                setRoutes.add("/" + route);
        })
    }
}

function split(route) {
    if (typeof route === 'string') {
        return route.split('/')
    } else if (route.fast_slash) {
        return ''
    } else {
        let match = route.toString()
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '$')
            .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
        return match
            ? match[1].replace(/\\(.)/g, '$1').split('/')
            : route.toString()
    }
}

module.exports = {
    print
}