import { Type } from '@sinclair/typebox'
import { API_APP, sendError } from '../../../app.js'
import { getFirestore } from 'firebase-admin/firestore'
import { sanitize } from '../../sanitize.js'
import { HTTPResponses } from 'data-types'
import { getUIDFromToken } from 'database'

export async function getUserDoc(id: string) {

    const firestore = getFirestore()
    const packs = firestore.collection('users')

    const doc = await packs.doc(id).get()
    if (doc.exists) {
        return doc
    }
    const query = await packs.where('cleanName', '==', sanitize(id)).limit(1).get()

    if (query.docs.length == 0)
        return undefined

    return query.docs[0]
}

API_APP.route({
    method: 'GET',
    url: '/users/:id',
    schema: {
        params: Type.Object({
            id: Type.String()
        })
    },
    handler: async (request, reply) => {
        const {id} = request.params

        const userDoc = await getUserDoc(id)

        if(userDoc === undefined)
            return sendError(reply, HTTPResponses.NOT_FOUND, 'User not found')
        return {uid: userDoc.id, ...userDoc.data()}
    }
})

API_APP.route({
    method: 'GET',
    url: '/users/:id/setup',
    schema: {
        params: Type.Object({
            id: Type.String()
        }),
        querystring: Type.Object({
            token: Type.String(),
            displayName: Type.String()
        })
    },
    handler: async (request, reply) => {
        const {id} = request.params
        const {token, displayName} = request.query

        const userDoc = await getUserDoc(id)

        const uidFromToken = await getUIDFromToken(token)

        if(userDoc !== undefined)
            return sendError(reply, HTTPResponses.NOT_FOUND, 'User has been setup previously')
        else if(uidFromToken === undefined)
            return sendError(reply, HTTPResponses.UNAUTHORIZED, 'Invalid token')
        else if (id !== uidFromToken)
            return sendError(reply, HTTPResponses.FORBIDDEN, 'Specified user does not belong to token')
        else if(await getUserDoc(displayName) !== undefined)
            return sendError(reply, HTTPResponses.CONFLICT, 'User with that display name exists!')


        await getFirestore().collection("users").doc(uidFromToken).set({
            displayName: displayName,
            cleanName: sanitize(displayName),
            role: 'member'
        })
        return reply.status(HTTPResponses.CREATED).send('User account was successfully setup')
    }
})
