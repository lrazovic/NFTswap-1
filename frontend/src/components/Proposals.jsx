/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react"
import {
  callGetProposalsCount,
  callGetMyProposals,
  callGetBidsFromProposal,
  callBids,
  callGetMyBids,
  callBidsCount,
  callAcceptBid,
  callRefuseBid,
  callDeleteBid,
  callDeleteProposal,
} from "../utils/blockchain"
import { useWeb3React } from "@web3-react/core"
import Spacer from "./Spacer"
import Card from "./Card"
import { sanityclient } from "../utils/sanity"
import CardInfo from "./CardInfo"
import toast, { Toaster } from "react-hot-toast"
import ProcessingButton from "./ProcessingButton"
//import { useBetween } from "use-between"


const Ok = 0
const Error = 1

const notify = (status, message) => {
  switch (status) {
  case Ok:
    toast.success(message)
    break
  case Error:
    toast.error(message)
    break
  }
}

export default function Proposals() {
  const [nft, setNft] = useState([])
  const [myBids, setMyBids] = useState([])
  const [bids, setBids] = useState({})
  const [bidsId, setBidsId] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bidLoading, setBidLoading] = useState(true)
  const [asset, setAsset] = useState(null)
  const [error, setError] = useState("")
  const [proposalsId, setProposalsId] = useState([])
  const { account, active } = useWeb3React()
  const [refuseLoading, setRefuseLoading] = useState(false)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [deleteProposalLoading, setDeleteProposalLoading] = useState(false)
  const [deleteBidLoading, setDeleteBidLoading] = useState(false)
  const [reload, setReload] = useState(false)
  //const useSharedCounter = () => useBetween(reload)

  useEffect(async () => {
    if (active) {
      try {
        // Clear `nft` arrray, to handle `account` change
        setNft([])

        // Get proposals for the connected user
        const proposalsCount = parseInt(await callGetProposalsCount(), 16) - 1
        const proposals = await callGetMyProposals(proposalsCount)

        // An array with all the proposals ids of the connected user
        let proposalIds = []
        for (let proposal of proposals) {
          let { nftAddress, proposalId, tokenId } = proposal
          nftAddress = nftAddress.toLowerCase()
          proposalIds.push(proposal.proposalId)
          const query = `*[_type == 'nfts' && _id == "${nftAddress}-${tokenId}"][0]`
          let collectionData = await sanityclient.fetch(query)
          collectionData = { ...collectionData, proposalId }
          setNft((prevState) => [...prevState, collectionData])
        }

        // Save the proposals ids in the state
        // Is it necessary?
        setProposalsId(proposalIds)

        let bidIds = {}
        // An object with as key a `proposalId`, as value an array of bids
        let biddedNftsData = {}
        for (let proposalId of proposalIds) {
          // Ritorna un array di BidsRef
          bidIds[proposalId] = await callGetBidsFromProposal(proposalId)

          for (let b in bidIds[proposalId]) {
            let bid = await callBids(bidIds[proposalId][b].toString())

            // Empty bid filter
            if (
              bid.nftAddress.toLowerCase() ===
              "0x0000000000000000000000000000000000000000"
            ) {
              continue
            }
            if (biddedNftsData[proposalId] === undefined) {
              biddedNftsData[proposalId] = []
              biddedNftsData[proposalId].push(bid)
            } else {
              biddedNftsData[proposalId].push(bid)
            }
          }
        }
        // Save everyting in a state
        setBidsId(bidIds)
        setBids(biddedNftsData)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        console.error(err)
      }
    }
  }, [account, reload])

  useEffect(async () => {
    setMyBids([])
    setBidLoading(true)
    const bidsCount = await callBidsCount()
    const myBids = await callGetMyBids(bidsCount.toString())
    setBidLoading(false)
    setMyBids(myBids)
  }, [account])

  const handleCardClick = useCallback(
    (asset) => async () => {
      setShowModal(true)
      setAsset(asset)
    },
    []
  )

  const handleAcceptBid = useCallback(
    (index) => async () => {
      try {
        setAcceptLoading(true)
        await callAcceptBid(
          asset.proposalId.toString(),
          bidsId[asset.proposalId][index].toString()
        )
        setAcceptLoading(false)
        setShowModal(false)
        notify(Ok, "NFT Swapped!")
        setReload(!reload)
      } catch (error) {
        setAcceptLoading(false)
        setError(error.message)
        console.error(error)
      }
    },
    [bidsId, asset]
  )

  const handleRefuseBid = useCallback(
    (index) => async () => {
      try {
        setRefuseLoading(true)
        await callRefuseBid(
          asset.proposalId.toString(),
          bidsId[asset.proposalId][index].toString()
        )
        setRefuseLoading(false)
        notify(Ok, "Bid refused")
      } catch (error) {
        setRefuseLoading(false)
        setError(error.message)
        console.error(error)
      }
    },
    [bidsId, asset]
  )

  const handleDeleteBid = useCallback(
    (index) => async () => {
      try {
        setDeleteBidLoading(true)
        await callDeleteBid(myBids[index].bidId.toString())
        setDeleteBidLoading(false)
        notify(Ok, "Bid deleted successfully")
      } catch (error) {
        notify(Error, "Error deleting bid")
        setDeleteBidLoading(false)
        console.error(error)
      }
    },
    [bidsId, myBids]
  )

  const handleDeleteProposal = useCallback(
    () => async () => {
      try {
        setDeleteProposalLoading(true)
        await callDeleteProposal(asset.proposalId.toString())
        setDeleteProposalLoading(false)
        setShowModal(false)
        setReload(!reload)
        notify(Ok, "Proposal deleted successfully")
      } catch (error) {
        setError(error.message)
        notify(Error, "Error deleting proposal")
        setDeleteProposalLoading(false)
        console.error(error)
      }
    },
    [asset]
  )

  if (!window.ethereum) {
    return (
      <div className="container mx-auto">
        <h2 className="text-xl font-bold basis-full justify-center">
          Install MetaMask
        </h2>
      </div>
    )
  }

  if (!active) {
    return (
      <div className="container mx-auto">
        <h2 className="text-xl font-bold basis-full justify-center">
          Connect a Wallet
        </h2>
      </div>
    )
  }

  return (
    <div className="container mx-auto">
      <h1 className="text-xl font-bold basis-full justify-center">
        Your proposals
      </h1>
      <Spacer space={32} />
      <div className="container">
        {loading ? (
          <div>Loading...</div>
        ) : nft && !loading && nft.length ? (
          nft.map((asset, index) => {
            return (
              <button key={index} onClick={handleCardClick(asset)}>
                <Card
                  title={asset.title}
                  description={asset.description}
                  image={asset.imageUrl}
                />
              </button>
            )
          })
        ) : (
          <div>No proposal found</div>
        )}
      </div>
      <Spacer space={32} />
      <h1 className="text-xl font-bold basis-full justify-center">Your Bids</h1>
      <Spacer space={32} />
      <div className="container">
        {bidLoading ? (
          <div>Loading...</div>
        ) : myBids && myBids.length > 0 ? (
          myBids.map((myBid, index) => {
            return (
              <div key={index} className="flex bg-sky-500/[.06]">
                <CardInfo
                  contractAddress={myBid.nftAddress}
                  tokenId={myBid.tokenId.toString()}
                />
                {!deleteBidLoading ?
                  <button
                    className="bg-red-400 text-white font-bold text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                    onClick={handleDeleteBid(index)}
                  >
                  Delete Bid
                  </button> : <ProcessingButton color="bg-red-400" />
                }
              </div>
            )
          })
        ) : (
          <div>No bids found</div>
        )}
      </div>
      <Toaster />
      {showModal ? (
        <>
          <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
            <div className="relative w-auto my-6 mx-auto max-w-3xl">
              {/*content*/}
              <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                {/*header*/}
                <div className="flex items-start justify-between p-5 border-b border-solid border-blueGray-200 rounded-t">
                  <h3 className="text-3xl font-semibold">
                    Bids for {asset.title}
                  </h3>
                  <button
                    className="p-1 ml-auto bg-transparent border-0 text-black opacity-5 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                    onClick={() => setShowModal(false)}
                  >
                    <span className="bg-transparent text-black opacity-5 h-6 w-6 text-2xl block outline-none focus:outline-none">
                      ×
                    </span>
                  </button>
                </div>
                {/*body*/}
                <div className="relative p-8">
                  {bids[asset.proposalId] !== undefined ? (
                    bids[asset.proposalId].map((bid, index) => {
                      return (
                        <div
                          key={index}
                          className="flex flex-row gap-1 bg-grey-100"
                        >
                          <a
                            href={`https://testnets.opensea.io/assets/${
                              bid.nftAddress
                            }/${bid.tokenId.toString()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CardInfo
                              contractAddress={bid.nftAddress}
                              tokenId={bid.tokenId.toString()}
                            />
                          </a>
                          {!refuseLoading ? (
                            <button
                              className="bg-red-400 text-white font-bold text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                              onClick={handleRefuseBid(index)}
                            >
                              Refuse Bid
                            </button>
                          ) : (
                            <ProcessingButton color="bg-red-400" />
                          )}
                          {!acceptLoading ? (
                            <button
                              className="bg-lime-500 text-white font-bold text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                              onClick={handleAcceptBid(index)}
                            >
                              Acccept Bid
                            </button>
                          ) : (
                            <ProcessingButton color="bg-lime-500" />
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div>No bids found :(</div>
                  )}
                </div>
                {/*footer*/}
                <div className="flex items-center justify-end p-6 border-t border-solid border-blueGray-200 rounded-b">
                  <button
                    className="text-red-500 background-transparent font-bold px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                    type="button"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                  {!deleteProposalLoading ?
                    <button
                      className="bg-red-600 text-white active:bg-emerald-600 font-bold text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                      type="button"
                      onClick={handleDeleteProposal()}
                    >
                    Delete Proposal
                    </button> : <ProcessingButton color="bg-red-600" />}
                  {error ? (
                    <div>
                      <p>{error}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
      ) : null}
    </div>
  )
}
